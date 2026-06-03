import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";
import { parseSaoPauloDateTime } from "@/lib/app-time";
import { createMetricAfterPublish } from "@/lib/post-metrics-server";

/** Extrai o file ID de uma URL do Google Drive em qualquer formato comum. */
function extractDriveFileId(url: string): string | null {
  // https://drive.google.com/file/d/FILE_ID/view
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?id=FILE_ID
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

export const maxDuration = 300; // 5 minutos (Vercel Pro/Enterprise)

const STREAM_THRESHOLD = 200 * 1024 * 1024; // 200 MB

export async function POST(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const ytToken = await getGoogleAccessToken(context, "youtube");

    const body = await request.json() as {
      assetUrl: string;
      title: string;
      description: string;
      format: string;
      scheduledAt?: string | null;
      thumbnailUrl?: string | null;
      postId?: string;
      allowDuplicate?: boolean;
    };

    const { assetUrl, title, description, format, scheduledAt, thumbnailUrl } = body;

    if (!assetUrl || !title) {
      return NextResponse.json({ error: "assetUrl e title são obrigatórios." }, { status: 400 });
    }

    // ── Download do arquivo ──────────────────────────────────────────────────
    if (body.postId && !body.allowDuplicate) {
      const { data: existingPublication } = await context.service
        .from("post_publications")
        .select("id,status")
        .eq("organization_id", context.organizationId)
        .eq("post_id", body.postId)
        .eq("platform", "youtube")
        .in("status", ["pending", "processing", "published", "scheduled"])
        .limit(1)
        .maybeSingle();

      if (existingPublication) {
        return NextResponse.json(
          { error: "Este post já tem publicação registrada no YouTube. Desative o canal ou confirme republicação para continuar." },
          { status: 409 }
        );
      }
    }

    let fileBuffer: ArrayBuffer | null = null;
    let contentType: string = "video/mp4";
    let fileSize: number = 0;
    let useStream = false;
    let driveStream: ReadableStream<Uint8Array> | null = null;

    const driveFileId = extractDriveFileId(assetUrl);

    if (driveFileId) {
      // Arquivo do Google Drive — busca metadados primeiro para saber o tamanho
      const driveToken = await getGoogleAccessToken(context, "drive");

      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=size,mimeType`,
        { headers: { Authorization: `Bearer ${driveToken}` } }
      );
      const meta = await metaRes.json() as { size?: string; mimeType?: string };
      const knownSize = meta.size ? parseInt(meta.size) : 0;
      contentType = meta.mimeType ?? "video/mp4";

      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
        { headers: { Authorization: `Bearer ${driveToken}` } }
      );
      if (!driveRes.ok) {
        const errData = await driveRes.json() as { error?: { message?: string } };
        const msg = errData?.error?.message ?? "Não foi possível baixar o arquivo do Google Drive.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      if (knownSize > STREAM_THRESHOLD) {
        // Modo streaming — não carrega em memória
        fileSize = knownSize;
        useStream = true;
        driveStream = driveRes.body!;
      } else {
        fileBuffer = await driveRes.arrayBuffer();
        contentType = driveRes.headers.get("content-type") ?? contentType;
        fileSize = fileBuffer.byteLength;
      }
    } else {
      // URL direta (Supabase Storage ou outro) — verifica tamanho via HEAD
      const headRes = await fetch(assetUrl, { method: "HEAD" });
      const knownSize = parseInt(headRes.headers.get("content-length") ?? "0");

      const fileRes = await fetch(assetUrl);
      if (!fileRes.ok) {
        return NextResponse.json({ error: "Não foi possível acessar o arquivo de mídia." }, { status: 400 });
      }

      if (knownSize > STREAM_THRESHOLD) {
        fileSize = knownSize;
        useStream = true;
        driveStream = fileRes.body!;
        contentType = fileRes.headers.get("content-type") ?? "video/mp4";
      } else {
        fileBuffer = await fileRes.arrayBuffer();
        contentType = fileRes.headers.get("content-type") ?? "video/mp4";
        fileSize = fileBuffer.byteLength;
      }
    }

    // ── Metadados do vídeo ───────────────────────────────────────────────────
    // `format` é mantido como metadado interno (ex: "Shorts", "Vídeo") para referência futura,
    // mas NÃO altera o conteúdo enviado ao YouTube — o próprio YouTube detecta Shorts
    // automaticamente pela duração (≤60s) e aspect ratio do vídeo.
    void format;
    const scheduledDate = scheduledAt ? parseSaoPauloDateTime(scheduledAt) : null;
    const snippet = { title, description, categoryId: "22" };
    const videoStatus = scheduledDate
      ? { privacyStatus: "private", publishAt: scheduledDate.toISOString(), selfDeclaredMadeForKids: false }
      : { privacyStatus: "public", selfDeclaredMadeForKids: false };

    // ── Passo 1: iniciar resumable upload ────────────────────────────────────
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ytToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": contentType,
          "X-Upload-Content-Length": String(fileSize),
        },
        body: JSON.stringify({ snippet, status: videoStatus }),
      }
    );

    if (!initRes.ok) {
      const errData = await initRes.json() as { error?: { message?: string } };
      const msg = errData?.error?.message ?? `Erro YouTube API (${initRes.status})`;
      return NextResponse.json({ error: msg }, { status: initRes.status });
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
      return NextResponse.json({ error: "YouTube não retornou URL de upload." }, { status: 500 });
    }

    // ── Passo 2: enviar os bytes (streaming ou buffer) ───────────────────────
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(useStream ? { body: driveStream, duplex: "half" } as any : { body: fileBuffer }),
    });

    if (!uploadRes.ok) {
      const errData = await uploadRes.json() as { error?: { message?: string } };
      const msg = errData?.error?.message ?? `Erro no upload (${uploadRes.status})`;
      return NextResponse.json({ error: msg }, { status: uploadRes.status });
    }

    const videoData = await uploadRes.json() as { id?: string };
    const videoId = videoData.id;
    if (!videoId) {
      return NextResponse.json({ error: "YouTube não retornou o ID do vídeo." }, { status: 500 });
    }

    // ── Thumbnail (best-effort) ──────────────────────────────────────────────
    if (thumbnailUrl) {
      try {
        const driveThumbId = extractDriveFileId(thumbnailUrl);
        let thumbBuffer: ArrayBuffer;
        let thumbContentType: string;

        if (driveThumbId) {
          const driveToken = await getGoogleAccessToken(context, "drive");
          const r = await fetch(
            `https://www.googleapis.com/drive/v3/files/${driveThumbId}?alt=media`,
            { headers: { Authorization: `Bearer ${driveToken}` } }
          );
          thumbBuffer = await r.arrayBuffer();
          thumbContentType = r.headers.get("content-type") ?? "image/jpeg";
        } else {
          const r = await fetch(thumbnailUrl);
          thumbBuffer = await r.arrayBuffer();
          thumbContentType = r.headers.get("content-type") ?? "image/jpeg";
        }

        await fetch(
          `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ytToken}`,
              "Content-Type": thumbContentType,
              "Content-Length": String(thumbBuffer.byteLength),
            },
            body: thumbBuffer,
          }
        );
      } catch {
        // Falha no thumbnail não impede o retorno de sucesso
      }
    }

    // ── Verificação pós-upload (best-effort) ────────────────────────────────
    let privacyStatus = scheduledDate ? "private" : "public";
    let uploadStatus = "uploaded";
    try {
      const verifyRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=status&id=${videoId}`,
        { headers: { Authorization: `Bearer ${ytToken}` } }
      );
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json() as { items?: { status: { privacyStatus: string; uploadStatus: string } }[] };
        const item = verifyData.items?.[0];
        if (item) {
          privacyStatus = item.status.privacyStatus;
          uploadStatus = item.status.uploadStatus;
        }
      }
    } catch {
      // Verificação falhou — mantém defaults
    }

    // ── Registrar publicação em post_publications ────────────────────────────
    if (body.postId) {
      const isScheduled = privacyStatus === "private" && !!scheduledDate;
      try {
        await context.service.from("post_publications").insert({
          id: crypto.randomUUID(),
          organization_id: context.organizationId,
          post_id: body.postId,
          platform: "youtube",
          status: isScheduled ? "scheduled" : "published",
          title: body.title ?? "",
          caption: body.description ?? "",
          format: body.format ?? "video",
          asset_url: body.assetUrl,
          external_id: videoId,
          permalink: `https://www.youtube.com/watch?v=${videoId}`,
          scheduled_at: scheduledDate?.toISOString() ?? null,
          published_at: isScheduled ? null : new Date().toISOString(),
          created_by: context.userId,
        });
        if (!isScheduled) {
          await createMetricAfterPublish(context.service, {
            organizationId: context.organizationId,
            platform: "youtube",
            externalId: `yt:${videoId}`,
            postId: body.postId,
            postTitle: body.title,
            permalink: `https://www.youtube.com/watch?v=${videoId}`,
            publishedAt: new Date().toISOString(),
            format: body.format,
          });
        }
      } catch {
        // Falha no registro não impede o retorno de sucesso
      }
    }

    return NextResponse.json({ videoId, privacyStatus, uploadStatus });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao publicar no YouTube." },
      { status: 401 }
    );
  }
}
