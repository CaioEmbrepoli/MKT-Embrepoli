import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const token = await getGoogleAccessToken(context, "youtube");

    const url = new URL(request.url);
    const videoId = url.searchParams.get("videoId");
    if (!videoId) return NextResponse.json({ error: "videoId obrigatório." }, { status: 400 });

    const params = new URLSearchParams({
      ids: "channel==MINE",
      metrics: "audienceWatchRatio",
      dimensions: "elapsedVideoTimeRatio",
      filters: `video==${videoId}`,
      startDate: "2005-02-14",
      endDate: new Date().toISOString().slice(0, 10),
      sort: "elapsedVideoTimeRatio"
    });

    const response = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("[video-retention] YT Analytics error:", response.status, JSON.stringify(data));
      return NextResponse.json({ retention: [], error: data?.error?.message ?? `HTTP ${response.status}` });
    }

    const headers: string[] = (data?.columnHeaders ?? []).map((h: any) => String(h.name));
    const ratioIndex = headers.indexOf("elapsedVideoTimeRatio");
    const watchIndex = headers.indexOf("audienceWatchRatio");

    console.log("[video-retention] rows:", data?.rows?.length ?? 0, "sample:", JSON.stringify((data?.rows ?? []).slice(0, 3)));

    const retention = (data?.rows ?? []).map((row: any) => ({
      position: Math.round(Number(row[ratioIndex] ?? 0) * 100),
      watchRatio: Math.round(Number(row[watchIndex] ?? 0) * 100 * 10) / 10
    })).filter((r: { position: number; watchRatio: number }) => Number.isFinite(r.position) && Number.isFinite(r.watchRatio));

    return NextResponse.json({ retention });
  } catch (error) {
    return NextResponse.json({ retention: [], error: error instanceof Error ? error.message : "Erro." }, { status: 200 });
  }
}
