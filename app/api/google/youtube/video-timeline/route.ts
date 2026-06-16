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

    const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? "30") || 30));
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const params = new URLSearchParams({
      ids: "channel==MINE",
      metrics: "views",
      dimensions: "day",
      filters: `video==${videoId}`,
      startDate,
      endDate,
      sort: "day"
    });

    const response = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json({ daily: [] });
    }

    const headers: string[] = (data?.columnHeaders ?? []).map((h: any) => String(h.name));
    const dayIndex = headers.indexOf("day");
    const viewsIndex = headers.indexOf("views");

    const daily = (data?.rows ?? []).map((row: any) => ({
      date: String(row[dayIndex] ?? ""),
      views: Number(row[viewsIndex] ?? 0)
    })).filter((r: { date: string; views: number }) => r.date);

    return NextResponse.json({ daily });
  } catch (error) {
    return NextResponse.json({ daily: [], error: error instanceof Error ? error.message : "Erro." }, { status: 200 });
  }
}
