import { NextResponse } from "next/server";
import { authContext, loadSessionBundle, mapGap, mapMessage } from "../shared";

export const dynamic = "force-dynamic";

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const { gapId, answer } = await request.json() as { gapId?: string; answer?: string };
    const cleanGapId = gapId?.trim() ?? "";
    const cleanAnswer = answer?.trim() ?? "";
    if (!cleanGapId || !cleanAnswer) {
      return NextResponse.json({ error: "Gap e resposta são obrigatórios." }, { status: 400 });
    }

    const ctx = await authContext(request);
    const { data: gap, error: gapError } = await ctx.service
      .from("knowledge_gaps")
      .select("*")
      .eq("id", cleanGapId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (gapError) throw new Error(`knowledge gap select: ${gapError.message}`);
    if (!gap) return NextResponse.json({ error: "Pergunta não encontrada." }, { status: 404 });
    if (gap.user_id !== ctx.profile.id) return NextResponse.json({ error: "Este chat pertence a outro usuário." }, { status: 403 });
    if (gap.status !== "aguardando_resposta") return NextResponse.json({ error: "Esta pergunta já foi tratada." }, { status: 409 });

    const questionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { data: question, error: questionError } = await ctx.service
      .from("customer_questions")
      .insert({
        id: questionId,
        organization_id: ctx.organizationId,
        source: "manual",
        external_id: `chat_gap:${gap.id}`,
        question_text: gap.question_text,
        answer_text: cleanAnswer,
        author_name: ctx.profile.name || ctx.profile.email,
        likes: 0,
        status: "aprovado",
        category: null,
        learning: "Resposta adicionada pelo chat do Banco de Dúvidas.",
        needs_review: true,
        reviewed_at: null,
        reviewed_by: null,
        answered_at: now,
        created_at: now
      })
      .select("*")
      .single();
    if (questionError) throw new Error(`customer question insert: ${questionError.message}`);

    const { error: updateGapError } = await ctx.service
      .from("knowledge_gaps")
      .update({
        status: "convertido",
        customer_question_id: questionId,
        answered_at: now,
        resolved_by: ctx.profile.id,
        updated_at: now
      })
      .eq("id", gap.id);
    if (updateGapError) throw new Error(`knowledge gap update: ${updateGapError.message}`);

    await ctx.service.from("knowledge_chat_messages").insert({
      organization_id: ctx.organizationId,
      session_id: gap.session_id,
      user_id: ctx.profile.id,
      role: "system",
      content: "Resposta salva no Banco de Dúvidas. Ela ficará marcada para revisão.",
      created_at: now
    });

    const { data: reviewers } = await ctx.service
      .from("profiles")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("active", true)
      .in("role", ["admin", "gestor"]);

    const notificationRows = (reviewers ?? [])
      .filter((reviewer) => reviewer.id !== ctx.profile.id)
      .map((reviewer) => ({
        id: `notification:question:${questionId}:review:${reviewer.id}`,
        organization_id: ctx.organizationId,
        user_id: reviewer.id,
        title: "Nova resposta para revisar",
        description: gap.question_text.slice(0, 140),
        target_kind: "question",
        target_id: questionId,
        read: false,
        created_at: now
      }));
    if (notificationRows.length) {
      await ctx.service.from("notifications").upsert(notificationRows, { onConflict: "id" });
    }

    const bundle = await loadSessionBundle(ctx.service, gap.session_id);

    return NextResponse.json({
      question: {
        id: question.id,
        organizationId: question.organization_id,
        source: question.source,
        externalId: question.external_id,
        questionText: question.question_text,
        answerText: question.answer_text,
        authorName: question.author_name ?? "",
        likes: question.likes ?? 0,
        status: question.status,
        category: question.category ?? "",
        reviewerId: question.reviewer_id ?? undefined,
        learning: question.learning ?? "",
        needsReview: question.needs_review ?? true,
        createdAt: question.created_at
      },
      messages: (bundle.messages ?? []).map(mapMessage),
      gaps: (bundle.gaps ?? []).map(mapGap),
      activeGap: null,
      notificationKey: slug(gap.question_text)
    });
  } catch (error) {
    console.error("[knowledge-chat/gap-answer]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao salvar resposta." }, { status: 500 });
  }
}
