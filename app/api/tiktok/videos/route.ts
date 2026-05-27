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

    for (let page = 0; page < 10 && hasMore; page += 1) {
      const response = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(VIDEO_FIELDS)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          max_count: 20,
          ...(cursor != null ? { cursor } : {})
        })
      });
      const data = await response.json();
      if (!response.ok || (data?.error?.code && data.error.code !== "ok")) {
        throw new Error(data?.error?.message || data?.error?.code || "Nao foi possivel listar videos do TikTok.");
      }
      videos.push(...(data?.data?.videos ?? []));
      hasMore = Boolean(data?.data?.has_more);
      cursor = data?.data?.cursor;
      if (cursor == null) hasMore = false;
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
      videos: videos.map(normalizeVideo).filter((item) => item.id)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao importar dados do TikTok." }, { status: 401 });
  }
}
