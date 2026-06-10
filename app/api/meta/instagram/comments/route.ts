import { NextResponse } from "next/server";
import { fetchInstagramCommentsForMedia, fetchInstagramMedia, getInstagramConnection, metaRequestContext } from "@/lib/meta-server";

const DEFAULT_RECENT_DAYS = 30;
const DEFAULT_MAX_MEDIA = 80;
const DEFAULT_MAX_COMMENTS_PER_MEDIA = 100;

function positiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const recentDays = positiveInt(url.searchParams.get("days"), DEFAULT_RECENT_DAYS, 365);
    const maxMedia = positiveInt(url.searchParams.get("maxMedia"), DEFAULT_MAX_MEDIA, 250);
    const maxCommentsPerMedia = positiveInt(url.searchParams.get("maxCommentsPerMedia"), DEFAULT_MAX_COMMENTS_PER_MEDIA, 250);
    const since = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000);

    const context = await metaRequestContext(request);
    const connection = await getInstagramConnection(context);
    const media = await fetchInstagramMedia(connection.access_token, connection.instagram_account_id, {
      maxMedia,
      maxPages: Math.ceil(maxMedia / 100) + 1,
      since
    });
    const comments = [];
    let mediaWithComments = 0;
    let skippedWithoutComments = 0;

    for (const item of media) {
      if (item.commentsCount <= 0) {
        skippedWithoutComments += 1;
        continue;
      }
      mediaWithComments += 1;
      comments.push(...await fetchInstagramCommentsForMedia(connection.access_token, item, {
        since,
        maxComments: maxCommentsPerMedia,
        maxPages: Math.ceil(maxCommentsPerMedia / 100) + 1
      }));
    }

    return NextResponse.json({
      comments,
      mediaCount: media.length,
      summary: {
        recentDays,
        since: since.toISOString(),
        maxMedia,
        maxCommentsPerMedia,
        mediaChecked: media.length,
        mediaWithComments,
        skippedWithoutComments,
        commentsFound: comments.length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar comentarios do Instagram." },
      { status: 400 }
    );
  }
}
