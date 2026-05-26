import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";

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
    };

    const { assetUrl, title, description, format, scheduledAt } = body;

    if (!assetUrl || !title) {
      return NextResponse.json({ error: "assetUrl e title são obrigatórios." }, { status: 400 });
    }

    // ── Download do arquivo ──────────────────────────────────────────────────
    let fileBuffer: ArrayBuffer;
    let contentType: string;
    let fileSize: number;

    const driveFileId = extractDriveFileId(assetUrl);

    if (driveFileId) {
      // Arquivo do Google Drive — precisa de token OAuth do Drive
      const driveToken = await getGoogleAccessToken(context, "drive");
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
        { headers: { Authorization: `Bearer ${driveToken}` } }
      );
      if (!driveRes.ok) {
        const errData = await driveRes.json() as { error?: { message?: string } };
        const msg = errData?.error?.message ?? "Não foi possível baixar o arquivo do Google Drive.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      fileBuffer = await driveRes.arrayBuffer();
      contentType = driveRes.headers.get("content-type") ?? "video/mp4";
      fileSize = fileBuffer.byteLength;
    } else {
      // URL direta (Supabase Storage ou outro)
      const fileRes = await fetch(assetUrl);
      if (!fileRes.ok) {
        return NextResponse.json({ error: "Não foi possível acessar o arquivo de mídia." }, { status: 400 });
      }
      fileBuffer = await fileRes.arrayBuffer();
      contentType = fileRes.headers.get("content-type") ?? "video/mp4";
      fileSize = fileBuffer.byteLength;
    }

    // ── Metadados do vídeo ───────────────────────────────────────────────────
    const finalTitle = format === "Shorts" && !title.includes("#Shorts")
      ? `${title} #Shorts`
      : title;
    const finalDescription = format === "Shorts" && !description.includes("#Shorts")
      ? `${description}\n#Shorts`.trim()
      : description;

    const snippet = { title: finalTitle, description: finalDescription, categoryId: "22" };
    const videoStatus = scheduledAt
      ? { privacyStatus: "private", publishAt: new Date(scheduledAt).toISOString() }
      : { privacyStatus: "public" };

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

    // ── Passo 2: enviar os bytes ─────────────────────────────────────────────
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
      },
      body: fileBuffer,
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

    return NextResponse.json({ videoId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao publicar no YouTube." },
      { status: 401 }
    );
  }
}
