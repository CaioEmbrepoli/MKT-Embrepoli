import { NextResponse } from "next/server";
import {
  askKnowledgeAi,
  authContext,
  ensureTodaySession,
  loadAnswerBank,
  loadSessionBundle,
  mapGap,
  mapMessage,
  mapSession
} from "../shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { question } = await request.json() as { question?: string };
    const cleanQuestion = question?.trim() ?? "";
    if (!cleanQuestion) {
      return NextResponse.json({ error: "Pergunta vazia." }, { status: 400 });
    }

    const ctx = await authContext(request);
    const session = await ensureTodaySession(ctx);
    const now = new Date().toISOString();

    const { error: userMessageError } = await ctx.service.from("knowledge_chat_messages").insert({
      organization_id: ctx.organizationId,
      session_id: session.id,
      user_id: ctx.profile.id,
      role: "user",
      content: cleanQuestion,
      created_at: now
    });
    if (userMessageError) throw new Error(`chat user message insert: ${userMessageError.message}`);

    const bank = await loadAnswerBank(ctx);
    let aiMessageId = "";
    let activeGap = null;

    try {
      const ai = await askKnowledgeAi(cleanQuestion, bank);
      const answerText = ai.found && ai.answer
        ? ai.answer
        : "Ainda não sei responder isso com segurança pelo Banco de Dúvidas. Se você souber a resposta correta, me envie para alimentar o banco.";

      const { data: aiMessage, error: aiMessageError } = await ctx.service
        .from("knowledge_chat_messages")
        .insert({
          organization_id: ctx.organizationId,
          session_id: session.id,
          user_id: ctx.profile.id,
          role: "ai",
          content: answerText,
          provider: ai.provider,
          model: ai.model,
          unknown: !ai.found,
          confidence: ai.confidence,
          reason: ai.reason,
          created_at: new Date().toISOString()
        })
        .select("*")
        .single();
      if (aiMessageError) throw new Error(`chat ai message insert: ${aiMessageError.message}`);
      aiMessageId = aiMessage.id;

      if (ai.found && ai.matchedIds.length) {
        const { error: matchesError } = await ctx.service.from("knowledge_chat_matches").insert(
          ai.matchedIds.map((questionId) => ({
            organization_id: ctx.organizationId,
            session_id: session.id,
            message_id: aiMessage.id,
            question_id: questionId,
            confidence: ai.confidence,
            reason: ai.reason
          }))
        );
        if (matchesError) throw new Error(`chat matches insert: ${matchesError.message}`);
      } else if (!ai.found) {
        const { data: gap, error: gapError } = await ctx.service
          .from("knowledge_gaps")
          .insert({
            organization_id: ctx.organizationId,
            session_id: session.id,
            user_id: ctx.profile.id,
            question_text: cleanQuestion,
            status: "aguardando_resposta"
          })
          .select("*")
          .single();
        if (gapError) throw new Error(`knowledge gap insert: ${gapError.message}`);
        activeGap = gap;
        await ctx.service.from("knowledge_chat_messages").update({ gap_id: gap.id }).eq("id", aiMessage.id);
      }
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "Erro ao consultar a IA.";
      const { data: errorMessage } = await ctx.service
        .from("knowledge_chat_messages")
        .insert({
          organization_id: ctx.organizationId,
          session_id: session.id,
          user_id: ctx.profile.id,
          role: "error",
          content: "Erro ao consultar a IA. Tente novamente em instantes.",
          unknown: false,
          error_message: message
        })
        .select("*")
        .single();
      aiMessageId = errorMessage?.id ?? aiMessageId;
      console.error("[knowledge-chat/send] ai", aiError);
    }

    await ctx.service
      .from("knowledge_chat_sessions")
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", session.id);

    const bundle = await loadSessionBundle(ctx.service, session.id);
    const latestGap = activeGap ?? (bundle.gaps ?? []).find((gap) => gap.status === "aguardando_resposta") ?? null;

    return NextResponse.json({
      session: mapSession(session),
      messages: (bundle.messages ?? []).map(mapMessage),
      activeGap: latestGap ? mapGap(latestGap) : null,
      aiMessageId
    });
  } catch (error) {
    console.error("[knowledge-chat/send]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao enviar pergunta." }, { status: 500 });
  }
}
