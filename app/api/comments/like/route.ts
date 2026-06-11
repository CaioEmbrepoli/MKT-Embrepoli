import { NextResponse } from "next/server";
import { googleRequestContext } from "@/lib/google-server";
import {
  findInstagramCommentOnMedia,
  getInstagramConnection,
  likeInstagramComment,
  metaRequestContext,
  validateInstagramComment
} from "@/lib/meta-server";
import { recordCommentWebhookEvent, stripKnownCommentPrefix, type CommentSource } from "@/lib/comment-server";

type InstagramActionComment = {
  id: string;
  organization_id: string;
  source: string | null;
  external_id: string | null;
  video_id: string | null;
  author_name: string | null;
  text: string | null;
};

function isRecoverableInstagramActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /does not exist|missing permissions|does not support this operation|unsupported post request|cannot be loaded/i.test(message);
}

function friendlyInstagramActionError(action: "curtir" | "responder") {
  return `A Meta nao permitiu ${action} este comentario. Ele pode ter sido apagado, estar fora das permissoes da conexao atual ou nao aceitar essa operacao pela API. Reimporte os comentarios ou reconecte o Instagram e tente novamente.`;
}

function summarizeActionError(error: unknown) {
  return (error instanceof Error ? error.message : String(error ?? "Erro desconhecido")).slice(0, 500);
}

async function recordActionFailed(
  service: Awaited<ReturnType<typeof googleRequestContext>>["service"],
  organizationId: string,
  comment: InstagramActionComment,
  action: string,
  error: unknown
) {
  await recordCommentWebhookEvent(service, {
    organizationId,
    source: "instagram",
    eventId: `${comment.id}:${action}:failed:${Date.now()}`,
    externalCommentId: String(comment.external_id || ""),
    externalMediaId: String(comment.video_id || ""),
    eventType: "comment_action_failed",
    payload: {
      action,
      commentId: comment.id,
      externalId: comment.external_id,
      mediaId: comment.video_id,
      error: summarizeActionError(error)
    },
    processedAt: new Date().toISOString()
  }).catch(() => {});
}

async function recoverInstagramCommentId(
  service: Awaited<ReturnType<typeof googleRequestContext>>["service"],
  organizationId: string,
  accessToken: string,
  comment: InstagramActionComment
) {
  const found = await findInstagramCommentOnMedia(accessToken, String(comment.video_id || ""), {
    authorName: String(comment.author_name || ""),
    text: String(comment.text || "")
  });
  if (!found?.id) return "";

  const nextExternalId = `instagram:${found.id}`;
  if (nextExternalId !== comment.external_id) {
    const { error } = await service
      .from("comments")
      .update({ external_id: nextExternalId })
      .eq("organization_id", organizationId)
      .eq("id", comment.id);
    if (error) throw error;
  }
  return found.id;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const commentId = String(body.commentId || "").trim();
    if (!commentId) return NextResponse.json({ error: "commentId obrigatorio." }, { status: 400 });

    const context = await googleRequestContext(request);
    const { data: comment, error } = await context.service
      .from("comments")
      .select("id,organization_id,source,external_id,video_id,author_name,text")
      .eq("organization_id", context.organizationId)
      .eq("id", commentId)
      .maybeSingle();

    if (error) throw error;
    if (!comment) return NextResponse.json({ error: "Comentario nao encontrado." }, { status: 404 });

    const source = String(comment.source || "") as CommentSource;
    const externalId = String(comment.external_id || "");
    if (!externalId) {
      return NextResponse.json({ error: "Comentario sem ID externo para curtir no canal." }, { status: 400 });
    }

    if (source !== "instagram") {
      const labels: Record<CommentSource, string> = {
        youtube: "YouTube",
        instagram: "Instagram",
        tiktok: "TikTok",
        facebook: "Facebook"
      };
      return NextResponse.json(
        { error: `Curtir comentarios nao e suportado pela API do ${labels[source] ?? source} neste app.` },
        { status: 400 }
      );
    }

    const metaContext = await metaRequestContext(request);
    const connection = await getInstagramConnection(metaContext);
    let cleanExternalId = stripKnownCommentPrefix("instagram", externalId);
    try {
      await validateInstagramComment(connection.access_token, cleanExternalId);
      await likeInstagramComment(connection.access_token, cleanExternalId);
    } catch (firstError) {
      if (!isRecoverableInstagramActionError(firstError)) throw firstError;
      const recoveredId = await recoverInstagramCommentId(
        context.service,
        context.organizationId,
        connection.access_token,
        comment
      ).catch(() => "");
      if (!recoveredId) {
        await recordActionFailed(context.service, context.organizationId, comment, "like", firstError);
        return NextResponse.json({ error: friendlyInstagramActionError("curtir") }, { status: 400 });
      }
      cleanExternalId = recoveredId;
      try {
        await validateInstagramComment(connection.access_token, cleanExternalId);
        await likeInstagramComment(connection.access_token, cleanExternalId);
      } catch (retryError) {
        await recordActionFailed(context.service, context.organizationId, { ...comment, external_id: `instagram:${cleanExternalId}` }, "like", retryError);
        return NextResponse.json({ error: friendlyInstagramActionError("curtir") }, { status: 400 });
      }
    }

    const { data: updated, error: updateError } = await context.service
      .from("comments")
      .update({ liked_by_org: true })
      .eq("organization_id", context.organizationId)
      .eq("id", commentId)
      .select("*")
      .maybeSingle();
    if (updateError) throw updateError;

    await recordCommentWebhookEvent(context.service, {
      organizationId: context.organizationId,
      source,
      eventId: `${commentId}:like`,
      externalCommentId: `instagram:${cleanExternalId}`,
      externalMediaId: String(comment.video_id || ""),
      eventType: "comment_liked",
      payload: { commentId, externalId: `instagram:${cleanExternalId}` },
      processedAt: new Date().toISOString()
    });

    return NextResponse.json({ ok: true, comment: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao curtir comentario." },
      { status: 400 }
    );
  }
}
