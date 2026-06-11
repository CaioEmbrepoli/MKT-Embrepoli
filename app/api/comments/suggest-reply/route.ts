import { NextResponse } from "next/server";
import { authContext, suggestReplyForComment, loadAnswerBank } from "@/app/api/knowledge-chat/shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const commentId = String(body.commentId || "").trim();
    const force = Boolean(body.force);
    if (!commentId) {
      return NextResponse.json({ error: "commentId obrigatorio." }, { status: 400 });
    }

    const ctx = await authContext(request);
    const { data: comment, error: commentError } = await ctx.service
      .from("comments")
      .select("id, organization_id, text, video_title, suggested_reply")
      .eq("organization_id", ctx.organizationId)
      .eq("id", commentId)
      .maybeSingle();

    if (commentError) throw commentError;
    if (!comment) return NextResponse.json({ error: "Comentario nao encontrado." }, { status: 404 });

    const existingSuggestion = String(comment.suggested_reply ?? "").trim();
    if (!force && existingSuggestion) {
      return NextResponse.json({
        found: true,
        suggestion: existingSuggestion,
        confidence: 1,
        reason: "Sugestao ja salva no comentario.",
        matchedQuestionIds: []
      });
    }

    const bank = await loadAnswerBank(ctx);
    const result = await suggestReplyForComment(String(comment.text ?? ""), bank, { videoTitle: comment.video_title ?? undefined }, ctx);
    if (!result.found || !result.answer) {
      return NextResponse.json({
        found: false,
        confidence: result.confidence,
        reason: result.reason,
        matchedQuestionIds: result.matchedIds
      });
    }

    const suggestion = result.answer.trim();
    const { error: updateError } = await ctx.service
      .from("comments")
      .update({ suggested_reply: suggestion })
      .eq("organization_id", ctx.organizationId)
      .eq("id", commentId);
    if (updateError) throw updateError;

    return NextResponse.json({
      found: true,
      suggestion,
      confidence: result.confidence,
      reason: result.reason,
      matchedQuestionIds: result.matchedIds
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sugerir resposta." },
      { status: 400 }
    );
  }
}
