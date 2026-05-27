import { NextRequest } from "next/server";

const ALLOWED_HOST_PARTS = ["tiktok", "tiktokcdn", "muscdn", "byteimg"];

function isAllowedThumbnailUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_HOST_PARTS.some((part) => host.includes(part));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url") ?? "";
  if (!isAllowedThumbnailUrl(rawUrl)) {
    return Response.json({ error: "URL de thumbnail invalida." }, { status: 400 });
  }

  const upstream = await fetch(rawUrl, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      Referer: "https://www.tiktok.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
    },
    next: { revalidate: 86400 }
  });

  if (!upstream.ok) {
    return Response.json({ error: "Nao foi possivel carregar a thumbnail." }, { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": contentType
    }
  });
}
