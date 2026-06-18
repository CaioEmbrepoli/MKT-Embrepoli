import { NextResponse } from "next/server";
import { recordIntegrationFailure, toApiErrorPayload } from "@/lib/api-errors";
import { getTikTokAccessToken, tiktokRequestContext, type TikTokRequestContext } from "@/lib/tiktok-server";

const TIKTOK_COMMENTS_UNAVAILABLE_MESSAGE =
  "A API TikTok conectada ainda não permite ler o texto dos comentários. Habilite o produto/escopo oficial de comentários no TikTok Developer, reconecte a conta e tente novamente.";

const VIDEO_FIELDS = ["id", "title", "video_description", "comment_count", "create_time"].join(",");
const MAX_TIKTOK_VIDEO_PAGES = 50;
const TIKTOK_PAGE_SIZE = 20;

function parseScope(request: Request): "recent" | "all" {
  const scope = new URL(request.url).searchParams.get("scope");
  return scope === "all" ? "all" : "recent";
}

async function countVideosWithOfficialApi(accessToken: string) {
  let cursor: number | undefined;
  let hasMore = true;
  let pagesFetched = 0;
  let videoCount = 0;
  let videosWithComments = 0;
  const seenCursors = new Set<number>();

  while (hasMore && pagesFetched < MAX_TIKTOK_VIDEO_PAGES) {
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

    const videos = data?.data?.videos ?? [];
    videoCount += videos.length;
    videosWithComments += videos.filter((item: any) => Number(item.comment_count || 0) > 0).length;
    pagesFetched += 1;
    hasMore = Boolean(data?.data?.has_more);
    const nextCursor = data?.data?.cursor;
    if (nextCursor == null) {
      hasMore = false;
    } else if (seenCursors.has(Number(nextCursor))) {
      hasMore = false;
    } else {
      cursor = Number(nextCursor);
      seenCursors.add(cursor);
    }
  }

  return { videoCount, videosWithComments };
}

export async function GET(request: Request) {
  const scope = parseScope(request);
  let context: TikTokRequestContext | null = null;

  try {
    context = await tiktokRequestContext(request);
    const accessToken = await getTikTokAccessToken(context);
    const videoSummary = await countVideosWithOfficialApi(accessToken).catch(() => ({ videoCount: 0, videosWithComments: 0 }));

    return NextResponse.json(
      {
        error: TIKTOK_COMMENTS_UNAVAILABLE_MESSAGE,
        comments: [],
        summary: {
          videoCount: videoSummary.videoCount,
          videosWithComments: videoSummary.videosWithComments,
          commentsFound: 0,
          ignoredByDate: 0,
          unsupported: true,
          scope
        }
      },
      { status: 400 }
    );
  } catch (error) {
    const payload = toApiErrorPayload(error, { provider: "tiktok", service: "tiktok" });
    if (context) await recordIntegrationFailure(context.service, context.organizationId, payload);
    const isConnectionError = payload.action === "reconnect_oauth" || payload.code === "not_connected";
    return NextResponse.json(
      {
        ...payload,
        error: isConnectionError ? payload.userMessage : TIKTOK_COMMENTS_UNAVAILABLE_MESSAGE,
        comments: [],
        summary: {
          videoCount: 0,
          commentsFound: 0,
          ignoredByDate: 0,
          unsupported: true,
          scope
        }
      },
      { status: isConnectionError ? 401 : 400 }
    );
  }
}
