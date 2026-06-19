import { NextResponse } from "next/server";
import { recordIntegrationFailure, toApiErrorPayload } from "@/lib/api-errors";
import { fetchInstagramCommentsForMedia, fetchInstagramMedia, getInstagramConnection, metaRequestContext, type MetaRequestContext } from "@/lib/meta-server";

const DEFAULT_RECENT_DAYS = 30;
const DEFAULT_MAX_MEDIA = 80;
const DEFAULT_MAX_MEDIA_ALL = 500;
const DEFAULT_MAX_COMMENTS_PER_MEDIA = 100;

function positiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: Request) {
  let context: MetaRequestContext | null = null;
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") === "all" ? "all" : "recent";
    const recentDays = positiveInt(url.searchParams.get("days"), DEFAULT_RECENT_DAYS, 365);
    const maxMedia = positiveInt(url.searchParams.get("maxMedia"), scope === "all" ? DEFAULT_MAX_MEDIA_ALL : DEFAULT_MAX_MEDIA, 1000);
    const maxCommentsPerMedia = positiveInt(url.searchParams.get("maxCommentsPerMedia"), DEFAULT_MAX_COMMENTS_PER_MEDIA, 250);
    const since = scope === "all" ? undefined : new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000);

    context = await metaRequestContext(request);
    const connection = await getInstagramConnection(context);
    const media = await fetchInstagramMedia(connection.access_token, connection.instagram_account_id, {
      maxMedia,
      maxPages: Math.ceil(maxMedia / 100) + 1,
      since
    });
    const comments = [];
    let mediaWithComments = 0;
    let skippedWithoutComments = 0;
    let commentsMissingTimestamp = 0;

    for (const item of media) {
      if (item.commentsCount <= 0) {
        skippedWithoutComments += 1;
        continue;
      }
      mediaWithComments += 1;
      comments.push(...await fetchInstagramCommentsForMedia(connection.access_token, item, {
        since,
        maxComments: maxCommentsPerMedia,
        maxPages: Math.ceil(maxCommentsPerMedia / 100) + 1,
        ownUsername: connection.username,
        ownAccountId: connection.instagram_account_id
      }));
    }
    commentsMissingTimestamp = comments.filter((comment) => !comment.publishedAt).length;

    return NextResponse.json({
      comments,
      mediaCount: media.length,
      summary: {
        scope,
        recentDays,
        since: since ? since.toISOString() : null,
        maxMedia,
        maxCommentsPerMedia,
        mediaChecked: media.length,
        mediaWithComments,
        skippedWithoutComments,
        commentsMissingTimestamp,
        commentsFound: comments.length
      }
    });
  } catch (error) {
    const payload = toApiErrorPayload(error, { provider: "instagram", service: "instagram" });
    if (context) await recordIntegrationFailure(context.service, context.organizationId, payload, context.userId);
    return NextResponse.json(payload, { status: 400 });
  }
}
