import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");
  if (!fileId) return new NextResponse(null, { status: 400 });

  try {
    const context = await googleRequestContext(request);
    const token = await getGoogleAccessToken(context, "drive");
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink%2CmimeType%2Cname`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) return new NextResponse(null, { status: metaRes.status });
    const meta = await metaRes.json() as { thumbnailLink?: string; mimeType?: string };

    if (meta.thumbnailLink) {
      const thumbRes = await fetch(meta.thumbnailLink.replace(/=s\d+$/, "=s400"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!thumbRes.ok) return new NextResponse(null, { status: thumbRes.status });
      return new NextResponse(await thumbRes.arrayBuffer(), {
        headers: {
          "Content-Type": thumbRes.headers.get("Content-Type") ?? "image/jpeg",
          "Cache-Control": "private, max-age=3600"
        }
      });
    }

    if (meta.mimeType?.startsWith("image/")) {
      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!fileRes.ok) return new NextResponse(null, { status: fileRes.status });
      return new NextResponse(await fileRes.arrayBuffer(), {
        headers: {
          "Content-Type": meta.mimeType,
          "Cache-Control": "private, max-age=3600"
        }
      });
    }

    return new NextResponse(null, { status: 404 });
  } catch {
    return new NextResponse(null, { status: 401 });
  }
}
