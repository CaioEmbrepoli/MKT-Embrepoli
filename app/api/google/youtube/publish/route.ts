import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";

export async function POST(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const token = await getGoogleAccessToken(context, "youtube");

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

    // Baixa o arquivo (Supabase Storage URL)
    const fileResponse = await fetch(assetUrl);
    if (!fileResponse.ok) {
      return NextResponse.json({ error: "Não foi possível acessar o arquivo de mídia." }, { status: 400 });
    }
    const fileBuffer = await fileResponse.arrayBuffer();
    const contentType = fileResponse.headers.get("content-type") ?? "video/mp4";
    const fileSize = fileBuffer.byteLength;

    // #Shorts: adicionar hashtag se formato for Shorts
    const finalTitle = format === "Shorts" && !title.includes("#Shorts")
      ? `${title} #Shorts`
      : title;
    const finalDescription = format === "Shorts" && !description.includes("#Shorts")
      ? `${description}\n#Shorts`.trim()
      : description;

    // Metadados do vídeo
    const snippet = { title: finalTitle, description: finalDescription, categoryId: "22" };
    const status = scheduledAt
      ? { privacyStatus: "private", publishAt: new Date(scheduledAt).toISOString() }
      : { privacyStatus: "public" };

    // Passo 1: iniciar resumable upload no YouTube
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": contentType,
          "X-Upload-Content-Length": String(fileSize),
        },
        body: JSON.stringify({ snippet, status }),
      }
    );

    if (!initRes.ok) {
      const errorData = await initRes.json() as { error?: { message?: string } };
      const msg = errorData?.error?.message ?? `Erro YouTube API (${initRes.status})`;
      return NextResponse.json({ error: msg }, { status: initRes.status });
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
      return NextResponse.json({ error: "YouTube não retornou URL de upload." }, { status: 500 });
    }

    // Passo 2: enviar os bytes do arquivo
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const errorData = await uploadRes.json() as { error?: { message?: string } };
      const msg = errorData?.error?.message ?? `Erro no upload (${uploadRes.status})`;
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
