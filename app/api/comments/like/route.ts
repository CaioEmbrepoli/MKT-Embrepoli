import { NextResponse } from "next/server";
import { googleRequestContext } from "@/lib/google-server";
import { getInstagramConnection, likeInstagramComment, metaRequestContext } from "@/lib/meta-server";
import { recordCommentWebhookEvent, stripKnownCommentPrefix, type CommentSource } from "@/lib/comment-server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const commentId = String(body.commentId || "").trim();
    if (!commentId) return NextResponse.json({ error: "commentId obrigatorio." }, { status: 400 });

    const context = await googleRequestContext(request);
    const { data: comment, error } = await context.service
      .from("comments")
      .select("id,organization_id,source,external_id,video_id")
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
    await likeInstagramComment(connection.access_token, stripKnownCommentPrefix("instagram", externalId));

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
      externalCommentId: externalId,
      externalMediaId: String(comment.video_id || ""),
      eventType: "comment_liked",
      payload: { commentId, externalId },
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
