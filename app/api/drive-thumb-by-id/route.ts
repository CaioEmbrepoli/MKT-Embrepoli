import { NextResponse } from "next/server";

/**
 * GET /api/drive-thumb-by-id?fileId={id}&token={oauth_token}
 *
 * 1. Consulta a Drive API para obter o `thumbnailLink` do arquivo.
 * 2. Faz o proxy da imagem do thumbnail com autenticação Bearer.
 *
 * Usado nos cards do calendário de revisões para exibir previews
 * de arquivos do Google Drive sem expor o token no frontend.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");
  const token = searchParams.get("token");

  if (!fileId || !token) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    // 1. Busca metadados do arquivo para obter thumbnailLink e mimeType
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink%2CmimeType%2Cname`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!metaRes.ok) {
      return new NextResponse(null, { status: metaRes.status });
    }

    const meta = (await metaRes.json()) as { thumbnailLink?: string; mimeType?: string; name?: string };

    // Se tiver thumbnailLink (imagens, vídeos, docs), usa ele
    if (meta.thumbnailLink) {
      const thumbUrl = meta.thumbnailLink.replace(/=s\d+$/, "=s400"); // pede tamanho maior
      const thumbRes = await fetch(thumbUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!thumbRes.ok) {
        return new NextResponse(null, { status: thumbRes.status });
      }

      const blob = await thumbRes.arrayBuffer();
      const contentType = thumbRes.headers.get("Content-Type") ?? "image/jpeg";

      return new NextResponse(blob, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Fallback: tenta baixar o arquivo diretamente se for imagem
    if (meta.mimeType?.startsWith("image/")) {
      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!fileRes.ok) return new NextResponse(null, { status: fileRes.status });

      const blob = await fileRes.arrayBuffer();
      return new NextResponse(blob, {
        headers: {
          "Content-Type": meta.mimeType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Arquivo sem thumbnail (ex: pasta, tipo não suportado)
    return new NextResponse(null, { status: 404 });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
