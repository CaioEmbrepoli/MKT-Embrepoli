import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";

async function ytFetch(url: string, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? `Erro YouTube API (${response.status}).`);
  return data;
}

async function ytAnalyticsFetch(url: string, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Erro YouTube Analytics API (${response.status}).`);
  }
  return data;
}

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

type VideoAnalytics = {
  watchTimeMinutes?: number;
  averageViewDurationSeconds?: number;
  averageViewPercentage?: number;
  subscribersGained?: number;
  subscribersLost?: number;
  impressions?: number;
  impressionClickThroughRate?: number;
};

const analyticsStartDate = "2005-02-14";
const analyticsEndDate = () => new Date().toISOString().slice(0, 10);

function mergeAnalyticsRows(
  map: Map<string, VideoAnalytics>,
  data: any,
  fieldByMetric: Record<string, keyof VideoAnalytics>
) {
  const headers: string[] = (data?.columnHeaders ?? []).map((header: any) => String(header.name));
  const videoIndex = headers.indexOf("video");
  if (videoIndex < 0) return;

  for (const row of data?.rows ?? []) {
    const videoId = String(row[videoIndex] ?? "");
    if (!videoId) continue;
    const current = map.get(videoId) ?? {};
    headers.forEach((name, index) => {
      const field = fieldByMetric[name];
      if (!field) return;
      const raw = Number(row[index]);
      if (Number.isFinite(raw)) current[field] = raw;
    });
    map.set(videoId, current);
  }
}

async function fetchYouTubeAnalyticsByVideo(videoIds: string[], token: string) {
  const analytics = new Map<string, VideoAnalytics>();
  const warnings: string[] = [];
  const endDate = analyticsEndDate();

  for (let index = 0; index < videoIds.length; index += 50) {
    const chunk = videoIds.slice(index, index + 50);
    if (!chunk.length) continue;

    const baseParams = {
      ids: "channel==MINE",
      startDate: analyticsStartDate,
      endDate,
      dimensions: "video",
      filters: `video==${chunk.join(",")}`,
      maxResults: "50"
    };

    try {
      const params = new URLSearchParams({
        ...baseParams,
        metrics: [
          "estimatedMinutesWatched",
          "averageViewDuration",
          "averageViewPercentage",
          "subscribersGained",
          "subscribersLost",
          "shares"
        ].join(",")
      });
      const data = await ytAnalyticsFetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, token);
      mergeAnalyticsRows(analytics, data, {
        estimatedMinutesWatched: "watchTimeMinutes",
        averageViewDuration: "averageViewDurationSeconds",
        averageViewPercentage: "averageViewPercentage",
        subscribersGained: "subscribersGained",
        subscribersLost: "subscribersLost"
      });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Nao foi possivel carregar YouTube Analytics.");
      break;
    }

    try {
      const params = new URLSearchParams({
        ...baseParams,
        metrics: "impressions,impressionClickThroughRate"
      });
      const data = await ytAnalyticsFetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, token);
      mergeAnalyticsRows(analytics, data, {
        impressions: "impressions",
        impressionClickThroughRate: "impressionClickThroughRate"
      });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Impressões/CTR não disponíveis para esta conta.");
    }
  }

  return { analytics, warnings: Array.from(new Set(warnings)) };
}

export async function GET(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const token = await getGoogleAccessToken(context, "youtube");
    const channelData = await ytFetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", token);
    const playlistId = channelData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!playlistId) throw new Error("Nenhum canal do YouTube encontrado nesta conta Google.");

    const ids: string[] = [];
    let pageToken = "";
    do {
      const params = new URLSearchParams({ part: "contentDetails", playlistId, maxResults: "50" });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await ytFetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, token);
      for (const item of page.items ?? []) {
        if (item?.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
      }
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);

    const videos = [];
    const { analytics, warnings } = await fetchYouTubeAnalyticsByVideo(ids, token).catch((error) => ({
      analytics: new Map<string, VideoAnalytics>(),
      warnings: [error instanceof Error ? error.message : "Nao foi possivel carregar YouTube Analytics."]
    }));

    for (let index = 0; index < ids.length; index += 50) {
      const chunk = ids.slice(index, index + 50);
      const params = new URLSearchParams({
        part: "snippet,statistics,contentDetails,status",
        id: chunk.join(","),
        maxResults: "50"
      });
      const data = await ytFetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, token);
      for (const item of data.items ?? []) {
        const snippet = item.snippet ?? {};
        const stats = item.statistics ?? {};
        const durationSec = parseDurationSeconds(item.contentDetails?.duration ?? "");
        const extra = analytics.get(item.id) ?? {};
        videos.push({
          videoId: item.id,
          title: snippet.title ?? "",
          description: snippet.description ?? "",
          publishedAt: (snippet.publishedAt ?? "").slice(0, 10),
          thumbnail: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? "",
          viewCount: parseInt(stats.viewCount ?? "0", 10) || 0,
          likeCount: parseInt(stats.likeCount ?? "0", 10) || 0,
          commentCount: parseInt(stats.commentCount ?? "0", 10) || 0,
          isShort: durationSec > 0 && durationSec <= 60,
          privacyStatus: (item.status?.privacyStatus ?? "public") as "public" | "unlisted" | "private",
          ...extra
        });
      }
    }

    return NextResponse.json({ videos, analyticsWarnings: warnings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao importar YouTube." }, { status: 401 });
  }
}
