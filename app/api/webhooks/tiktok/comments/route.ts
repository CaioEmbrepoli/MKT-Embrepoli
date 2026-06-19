import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { commentServiceClient, createServerQuestionsFromComments, getDefaultOrganizationId, recordCommentWebhookEvent, upsertServerComments } from "@/lib/comment-server";
import { recordDiagnostic } from "@/lib/api-errors";

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function extractTikTokComment(payload: any) {
  const value = payload?.event ?? payload?.data ?? payload;
  const videoId = safeText(value.video_id || value.item_id || value.media_id);
  const commentId = safeText(value.comment_id || value.id);
  const text = safeText(value.text || value.comment_text || value.content);
  const authorName = safeText(value.author_name || value.username || value.user?.display_name || value.user?.username || "TikTok");
  const publishedAt = value.create_time
    ? new Date(Number(value.create_time) * 1000).toISOString()
    : safeText(value.created_at || value.publish_time || new Date().toISOString());

  if (!commentId || !text) return null;
  return {
    source: "tiktok" as const,
    externalId: `tiktok:${videoId}:comment:${commentId}`,
    videoId,
    videoTitle: safeText(value.video_title || value.title || "Video TikTok"),
    authorName,
    text,
    likes: Number(value.like_count || value.likes || 0),
    publishedAt
  };
}

export async function POST(request: Request) {
  let service: ReturnType<typeof commentServiceClient> | null = null;
  let organizationId = "";
  try {
    const payload = await request.json().catch(() => ({}));
    service = commentServiceClient();
    organizationId = await getDefaultOrganizationId(service);
    const eventId = safeText(payload.event_id || payload.id || crypto.randomUUID());
    const comment = extractTikTokComment(payload);

    await recordCommentWebhookEvent(service, {
      organizationId,
      source: "tiktok",
      eventId,
      externalCommentId: comment?.externalId,
      externalMediaId: comment?.videoId,
      eventType: safeText(payload.event_type || payload.type || "comment"),
      payload,
      processedAt: comment ? new Date().toISOString() : null,
      error: comment ? null : "Evento TikTok recebido sem texto/ID de comentario."
    });

    if (comment) {
      const upserted = await upsertServerComments(service, organizationId, [comment]);
      await createServerQuestionsFromComments(service, organizationId, upserted as Array<Record<string, any>>);
    }

    return NextResponse.json({
      received: true,
      processed: Boolean(comment),
      note: comment ? undefined : "A API TikTok atual ainda nao enviou texto de comentario neste evento."
    });
  } catch (error) {
    if (service && organizationId) {
      await recordDiagnostic(service, {
        organizationId,
        provider: "tiktok",
        service: "tiktok",
        error,
        category: "webhook",
        severity: "erro",
        eventKey: "webhook:tiktok:comments",
        title: "Falha no webhook de comentários do TikTok",
        targetKind: "webhook",
        targetId: "tiktok-comments",
        metadata: { eventType: "comments" }
      }).catch(() => undefined);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao processar webhook do TikTok." },
      { status: 400 }
    );
  }
}
