import { NextResponse } from "next/server";
import { getTikTokAccessToken, tiktokRequestContext } from "@/lib/tiktok-server";

/** Extrai o file ID de uma URL do Google Drive em qualquer formato comum. */
function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

export const maxDuration = 300; // 5 minutos

export async function POST(request: Request) {
  try {
    const context = await tiktokRequestContext(request);
    const accessToken = await getTikTokAccessToken(context);

    const body = await request.json() as {
      assetUrl: string;
      title: string;
      description?: string;
      format?: string;
      scheduledAt?: string | null;
      privacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
    };

    const { assetUrl, title, privacyLevel } = body;

    if (!assetUrl || !title) {
      return NextResponse.json({ error: "assetUrl e title são obrigatórios." }, { status: 400 });
    }

    // ── Download do arquivo ──────────────────────────────────────────────────
    let fileBuffer: ArrayBuffer;
    let fileSize: number;

    const driveFileId = extractDriveFileId(assetUrl);

    if (driveFileId) {
      // Arquivo do Google Drive — busca token via service client do contexto TikTok
      const { data: conn } = await context.service
        .from("google_connections")
        .select("access_token")
        .eq("organization_id", context.organizationId)
        .eq("service", "drive")
        .maybeSingle();

      if (!conn?.access_token) {
        return NextResponse.json({ error: "Google Drive não conectado. Conecte o Google Drive nas configurações." }, { status: 400 });
      }

      const driveToken = conn.access_token as string;

      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=size,mimeType`,
        { headers: { Authorization: `Bearer ${driveToken}` } }
      );
      const meta = await metaRes.json() as { size?: string; mimeType?: string };
      const knownSize = meta.size ? parseInt(meta.size) : 0;

      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
        { headers: { Authorization: `Bearer ${driveToken}` } }
      );
      if (!driveRes.ok) {
        const errData = await driveRes.json() as { error?: { message?: string } };
        return NextResponse.json({ error: errData?.error?.message ?? "Não foi possível baixar o arquivo do Google Drive." }, { status: 400 });
      }

      fileBuffer = await driveRes.arrayBuffer();
      fileSize = knownSize > 0 ? knownSize : fileBuffer.byteLength;
    } else {
      // URL direta (Supabase Storage ou outro)
      const fileRes = await fetch(assetUrl);
      if (!fileRes.ok) {
        return NextResponse.json({ error: "Não foi possível acessar o arquivo de mídia." }, { status: 400 });
      }
      fileBuffer = await fileRes.arrayBuffer();
      fileSize = fileBuffer.byteLength;
    }

    // ── Passo 1: iniciar upload (init) ───────────────────────────────────────
    const chunkSize = 64 * 1024 * 1024; // 64 MB (máximo TikTok)
    const totalChunks = Math.ceil(fileSize / chunkSize);

    const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: title.slice(0, 150),
          privacy_level: privacyLevel ?? "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: fileSize,
          chunk_size: Math.min(chunkSize, fileSize),
          total_chunk_count: totalChunks,
        },
      }),
    });

    const initData = await initRes.json() as {
      data?: { publish_id: string; upload_url: string };
      error?: { code: string; message: string };
    };

    if (initData.error?.code && initData.error.code !== "ok") {
      return NextResponse.json({ error: initData.error.message ?? "Erro ao iniciar upload no TikTok." }, { status: 400 });
    }

    if (!initData.data?.publish_id || !initData.data?.upload_url) {
      return NextResponse.json({ error: "TikTok não retornou publish_id ou upload_url." }, { status: 500 });
    }

    const { publish_id, upload_url } = initData.data;

    // ── Passo 2: upload por chunks ───────────────────────────────────────────
    const buf = Buffer.from(fileBuffer);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize) - 1;
      const chunk = buf.subarray(start, end + 1);

      const uploadRes = await fetch(upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(chunk.byteLength),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        },
        body: chunk,
      });

      if (!uploadRes.ok && uploadRes.status !== 206) {
        const errText = await uploadRes.text().catch(() => String(uploadRes.status));
        return NextResponse.json(
          { error: `Erro no chunk ${i + 1}/${totalChunks}: ${uploadRes.status} — ${errText}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ publishId: publish_id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao publicar no TikTok." },
      { status: 500 }
    );
  }
}
