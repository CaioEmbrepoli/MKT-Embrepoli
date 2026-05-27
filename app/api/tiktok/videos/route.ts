import { NextResponse } from "next/server";
import { fetchTikTokUserInfo, getTikTokAccessToken, tiktokRequestContext } from "@/lib/tiktok-server";

const VIDEO_FIELDS = [
  "id",
  "title",
  "video_description",
  "duration",
  "cover_image_url",
  "embed_link",
  "share_url",
  "create_time",
  "view_count",
  "like_count",
  "comment_count",
  "share_count"
].join(",");

const MAX_TIKTOK_VIDEO_PAGES = 50;
const MAX_TIKTOK_VIDEOS = 1000;
const TIKTOK_PAGE_SIZE = 20;

function normalizeVideo(item: any) {
  return {
    id: String(item.id || ""),
    title: String(item.title || item.video_description || "Video TikTok"),
    description: String(item.video_description || item.title || ""),
    coverImageUrl: String(item.cover_image_url || ""),
    shareUrl: String(item.share_url || ""),
    embedLink: String(item.embed_link || ""),
    createTime: Number(item.create_time || 0),
    viewCount: Number(item.view_count || 0),
    likeCount: Number(item.like_count || 0),
    commentCount: Number(item.comment_count || 0),
    shareCount: Number(item.share_count || 0)
  };
}

export async function GET(request: Request) {
  try {
    const context = await tiktokRequestContext(request);
    const accessToken = await getTikTokAccessToken(context);
    const userInfo = await fetchTikTokUserInfo(accessToken);
    const videos: any[] = [];
    let cursor: number | undefined;
    let hasMore = true;
    let pagesFetched = 0;
    let stoppedByLimit = false;
    const seenCursors = new Set<number>();

    while (hasMore && pagesFetched < MAX_TIKTOK_VIDEO_PAGES && videos.length < MAX_TIKTOK_VIDEOS) {
      const response = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(VIDEO_FIELDS)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          max_count: TIKTOK_PAGE_SIZE,
          ...(cursor != null ? { cursor } : {})
        })
      });
      const data = await response.json();
      if (!response.ok || (data?.error?.code && data.error.code !== "ok")) {
        throw new Error(data?.error?.message || data?.error?.code || "Nao foi possivel listar videos do TikTok.");
      }
      videos.push(...(data?.data?.videos ?? []));
      pagesFetched += 1;
      hasMore = Boolean(data?.data?.has_more);
      const nextCursor = data?.data?.cursor;
      if (nextCursor == null) {
        hasMore = false;
      } else if (seenCursors.has(Number(nextCursor))) {
        stoppedByLimit = true;
        hasMore = false;
      } else {
        cursor = Number(nextCursor);
        seenCursors.add(cursor);
      }
    }

    if (hasMore && (pagesFetched >= MAX_TIKTOK_VIDEO_PAGES || videos.length >= MAX_TIKTOK_VIDEOS)) {
      stoppedByLimit = true;
    }

    return NextResponse.json({
      profile: {
        openId: String(userInfo.open_id || ""),
        displayName: String(userInfo.display_name || "Conta TikTok"),
        avatarUrl: String(userInfo.avatar_url || ""),
        followerCount: Number(userInfo.follower_count || 0),
        followingCount: Number(userInfo.following_count || 0),
        likesCount: Number(userInfo.likes_count || 0),
        videoCount: Number(userInfo.video_count || 0)
      },
      videos: videos.slice(0, MAX_TIKTOK_VIDEOS).map(normalizeVideo).filter((item) => item.id),
      importSummary: {
        totalFetched: videos.length,
        pagesFetched,
        hasMore,
        stoppedByLimit
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao importar dados do TikTok." }, { status: 401 });
  }
}
