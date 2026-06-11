import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";
import {
  findInstagramCommentOnMedia,
  getInstagramConnection,
  metaRequestContext,
  replyToInstagramComment,
  validateInstagramComment
} from "@/lib/meta-server";
import { recordCommentWebhookEvent, stripKnownCommentPrefix, updateServerCommentResponse, type CommentSource } from "@/lib/comment-server";

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

async function replyToYouTubeComment(accessToken: string, parentId: string, text: string) {
  const response = await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      snippet: {
        parentId,
        textOriginal: text
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || "Nao foi possivel responder o comentario no YouTube.");
  }
  return data as { id?: string };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const commentId = String(body.commentId || "").trim();
    const responseText = String(body.response || "").trim();

    if (!commentId) return NextResponse.json({ error: "commentId obrigatorio." }, { status: 400 });
    if (!responseText) return NextResponse.json({ error: "Resposta obrigatoria." }, { status: 400 });
    if (responseText.length > 5000) return NextResponse.json({ error: "Resposta muito longa." }, { status: 400 });

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
      return NextResponse.json({ error: "Comentario sem ID externo para responder no canal." }, { status: 400 });
    }

    let externalReplyId = "";
    let actionExternalId = externalId;
    if (source === "youtube") {
      const token = await getGoogleAccessToken(context, "youtube");
      const reply = await replyToYouTubeComment(token, stripKnownCommentPrefix("youtube", externalId), responseText);
      externalReplyId = reply.id ?? "";
    } else if (source === "instagram") {
      const metaContext = await metaRequestContext(request);
      const connection = await getInstagramConnection(metaContext);
      let cleanExternalId = stripKnownCommentPrefix("instagram", externalId);
      try {
        await validateInstagramComment(connection.access_token, cleanExternalId);
        const reply = await replyToInstagramComment(connection.access_token, cleanExternalId, responseText);
        externalReplyId = reply.id ?? "";
      } catch (firstError) {
        if (!isRecoverableInstagramActionError(firstError)) throw firstError;
        const recoveredId = await recoverInstagramCommentId(
          context.service,
          context.organizationId,
          connection.access_token,
          comment
        ).catch(() => "");
        if (!recoveredId) {
          await recordActionFailed(context.service, context.organizationId, comment, "reply", firstError);
          return NextResponse.json({ error: friendlyInstagramActionError("responder") }, { status: 400 });
        }
        cleanExternalId = recoveredId;
        try {
          await validateInstagramComment(connection.access_token, cleanExternalId);
          const reply = await replyToInstagramComment(connection.access_token, cleanExternalId, responseText);
          externalReplyId = reply.id ?? "";
          actionExternalId = `instagram:${cleanExternalId}`;
        } catch (retryError) {
          await recordActionFailed(context.service, context.organizationId, { ...comment, external_id: `instagram:${cleanExternalId}` }, "reply", retryError);
          return NextResponse.json({ error: friendlyInstagramActionError("responder") }, { status: 400 });
        }
      }
      if (externalReplyId && !actionExternalId.startsWith("instagram:")) {
        actionExternalId = `instagram:${cleanExternalId}`;
      }
    } else if (source === "tiktok") {
      return NextResponse.json(
        { error: "A API TikTok conectada ainda nao permite responder comentarios por rota oficial neste app." },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: "Resposta para comentarios do Facebook ainda nao foi integrada." },
        { status: 400 }
      );
    }

    const updated = await updateServerCommentResponse(context.service, context.organizationId, commentId, responseText);
    await recordCommentWebhookEvent(context.service, {
      organizationId: context.organizationId,
      source,
      eventId: externalReplyId || `${commentId}:${Date.now()}`,
      externalCommentId: actionExternalId,
      externalMediaId: String(comment.video_id || ""),
      eventType: "reply_sent",
      payload: { commentId, externalId: actionExternalId, externalReplyId, response: responseText },
      processedAt: new Date().toISOString()
    });

    return NextResponse.json({ ok: true, externalReplyId, comment: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao responder comentario." },
      { status: 400 }
    );
  }
}
