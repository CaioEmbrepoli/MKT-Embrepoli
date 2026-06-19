import { NextResponse } from "next/server";
import { googleRequestContext } from "@/lib/google-server";
import { recordCommentWebhookEvent, type CommentSource } from "@/lib/comment-server";
import { recordDiagnostic } from "@/lib/api-errors";

const sourceLabels: Record<CommentSource, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook"
};

function unsupportedLikeMessage(source: CommentSource) {
  if (source === "instagram") {
    return "A Meta nao permite curtir este comentario pela integracao. Abra no Instagram para curtir por la.";
  }
  return `Curtir comentarios nao e suportado pela API do ${sourceLabels[source] ?? source} neste app.`;
}

export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof googleRequestContext>> | null = null;
  let commentId = "";
  try {
    const body = await request.json().catch(() => ({}));
    commentId = String(body.commentId || "").trim();
    if (!commentId) return NextResponse.json({ error: "commentId obrigatorio." }, { status: 400 });

    context = await googleRequestContext(request);
    const { data: comment, error } = await context.service
      .from("comments")
      .select("id,source,external_id,video_id")
      .eq("organization_id", context.organizationId)
      .eq("id", commentId)
      .maybeSingle();

    if (error) throw error;
    if (!comment) return NextResponse.json({ error: "Comentario nao encontrado." }, { status: 404 });

    const source = String(comment.source || "") as CommentSource;
    const message = unsupportedLikeMessage(source);

    if (source === "instagram") {
      await recordCommentWebhookEvent(context.service, {
        organizationId: context.organizationId,
        source,
        eventId: `${commentId}:like:unsupported:${Date.now()}`,
        externalCommentId: String(comment.external_id || ""),
        externalMediaId: String(comment.video_id || ""),
        eventType: "comment_action_unsupported",
        payload: {
          action: "like",
          commentId,
          externalId: comment.external_id,
          mediaId: comment.video_id,
          reason: "instagram_comment_like_not_supported"
        },
        processedAt: new Date().toISOString()
      }).catch(() => {});
    }

    return NextResponse.json({ error: message }, { status: 400 });
  } catch (error) {
    if (context) {
      await recordDiagnostic(context.service, {
        organizationId: context.organizationId,
        provider: "instagram",
        service: "comments",
        error,
        category: "comentarios",
        severity: "erro",
        eventKey: `comentarios:acao:${commentId || "desconhecido"}`,
        title: "Falha ao executar ação em comentário",
        profileId: context.userId,
        targetKind: "comment",
        targetId: commentId || undefined,
        metadata: { operation: "curtir" }
      }).catch(() => undefined);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao processar acao de comentario." },
      { status: 400 }
    );
  }
}
