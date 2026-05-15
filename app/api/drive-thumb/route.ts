import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const token = searchParams.get("token");

  if (!url || !token) return new NextResponse(null, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return new NextResponse(null, { status: res.status });

    const blob = await res.arrayBuffer();
    const contentType = res.headers.get("Content-Type") ?? "image/jpeg";

    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
