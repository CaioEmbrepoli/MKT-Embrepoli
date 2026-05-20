import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";

type CommentResult = {
  id: string;
  videoId: string;
  text: string;
  authorName: string;
  likes: number;
  publishedAt: string;
};

async function ytFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Erro YouTube API (${res.status}).`);
  return data;
}

export async function GET(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const token = await getGoogleAccessToken(context, "youtube");
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");
    if (!videoId) return NextResponse.json({ error: "videoId obrigatório" }, { status: 400 });

    const comments: CommentResult[] = [];
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        part: "snippet",
        videoId,
        textFormat: "plainText",
        maxResults: "100",
        order: "relevance"
      });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await ytFetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?${params}`,
        token
      );
      for (const item of page.items ?? []) {
        const s = item.snippet?.topLevelComment?.snippet ?? {};
        comments.push({
          id: item.id as string,
          videoId: (item.snippet?.videoId as string) ?? videoId,
          text: (s.textDisplay as string) ?? "",
          authorName: (s.authorDisplayName as string) ?? "",
          likes: (s.likeCount as number) ?? 0,
          publishedAt: (s.publishedAt as string) ?? new Date().toISOString()
        });
      }
      pageToken = (page.nextPageToken as string) ?? "";
    } while (pageToken);

    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar comentários." },
      { status: 401 }
    );
  }
}
