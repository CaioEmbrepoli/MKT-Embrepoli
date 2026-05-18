import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";

async function ytFetch(url: string, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? `Erro YouTube API (${response.status}).`);
  return data;
}

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

export async function GET(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const token = await getGoogleAccessToken(context);
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
          privacyStatus: (item.status?.privacyStatus ?? "public") as "public" | "unlisted" | "private"
        });
      }
    }

    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao importar YouTube." }, { status: 401 });
  }
}
