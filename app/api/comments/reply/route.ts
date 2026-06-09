import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";
import { getInstagramConnection, metaRequestContext, replyToInstagramComment } from "@/lib/meta-server";
import { recordCommentWebhookEvent, stripKnownCommentPrefix, updateServerCommentResponse, type CommentSource } from "@/lib/comment-server";

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
      .select("id,organization_id,source,external_id,video_id,text")
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
    if (source === "youtube") {
      const token = await getGoogleAccessToken(context, "youtube");
      const reply = await replyToYouTubeComment(token, stripKnownCommentPrefix("youtube", externalId), responseText);
      externalReplyId = reply.id ?? "";
    } else if (source === "instagram") {
      const metaContext = await metaRequestContext(request);
      const connection = await getInstagramConnection(metaContext);
      const reply = await replyToInstagramComment(connection.access_token, stripKnownCommentPrefix("instagram", externalId), responseText);
      externalReplyId = reply.id ?? "";
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
      externalCommentId: externalId,
      externalMediaId: String(comment.video_id || ""),
      eventType: "reply_sent",
      payload: { commentId, externalId, externalReplyId, response: responseText },
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
