import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";
import {
  findInstagramCommentOnMedia,
  getInstagramConnection,
  metaRequestContext,
  replyToInstagramComment,
  validateInstagramComment
} from "@/lib/meta-server";
import { recordCommentWebhookEvent, stripKnownCommentPrefix, type CommentSource } from "@/lib/comment-server";
import { recordDiagnostic } from "@/lib/api-errors";

type ReplyMode = "create" | "edit";
type ReplyKind = "primary" | "additional";

type ResponseHistoryItem = {
  id: string;
  externalReplyId?: string;
  text: string;
  sentAt: string;
  editedAt?: string;
  source: CommentSource;
  kind: ReplyKind;
};

type CommentRow = {
  id: string;
  organization_id: string;
  source: string | null;
  external_id: string | null;
  video_id: string | null;
  video_title: string | null;
  author_name: string | null;
  text: string | null;
  response: string | null;
  response_external_id: string | null;
  response_history: unknown;
  bank_question_id: string | null;
};

function isRecoverableInstagramActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /does not exist|missing permissions|does not support this operation|unsupported post request|cannot be loaded/i.test(message);
}

function friendlyInstagramReplyError() {
  return "A Meta nao permitiu responder este comentario. Ele pode ter sido apagado, estar fora das permissoes da conexao atual ou nao aceitar essa operacao pela API. Reimporte os comentarios ou reconecte o Instagram e tente novamente.";
}

function sanitizeText(value: unknown) {
  return [...String(value ?? "")]
    .filter((char) => {
      const cp = char.codePointAt(0) ?? 0;
      return cp < 0xd800 || cp > 0xdfff;
    })
    .join("")
    .trim();
}

function normalizeHistory(value: unknown): ResponseHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): ResponseHistoryItem | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = sanitizeText(row.id);
      const text = sanitizeText(row.text);
      const sentAt = sanitizeText(row.sentAt);
      const source = sanitizeText(row.source) as CommentSource;
      const kind = sanitizeText(row.kind) as ReplyKind;
      if (!id || !text || !sentAt) return null;
      if (!["youtube", "instagram", "facebook", "tiktok"].includes(source)) return null;
      if (!["primary", "additional"].includes(kind)) return null;
      return {
        id,
        externalReplyId: sanitizeText(row.externalReplyId) || undefined,
        text,
        sentAt,
        editedAt: sanitizeText(row.editedAt) || undefined,
        source,
        kind
      };
    })
    .filter((item): item is ResponseHistoryItem => Boolean(item));
}

function withCreatedHistory(
  history: ResponseHistoryItem[],
  source: CommentSource,
  kind: ReplyKind,
  text: string,
  externalReplyId: string,
  now: string
) {
  return [
    {
      id: crypto.randomUUID(),
      externalReplyId: externalReplyId || undefined,
      text,
      sentAt: now,
      source,
      kind
    },
    ...history
  ];
}

function withEditedPrimaryHistory(
  history: ResponseHistoryItem[],
  source: CommentSource,
  text: string,
  externalReplyId: string,
  now: string
) {
  const existingPrimary = history.find((item) => item.kind === "primary" && item.externalReplyId === externalReplyId)
    ?? history.find((item) => item.kind === "primary");
  const edited: ResponseHistoryItem = {
    id: existingPrimary?.id ?? crypto.randomUUID(),
    externalReplyId,
    text,
    sentAt: existingPrimary?.sentAt ?? now,
    editedAt: now,
    source,
    kind: "primary"
  };
  return [edited, ...history.filter((item) => item.id !== edited.id)];
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

async function editYouTubeComment(accessToken: string, replyId: string, text: string) {
  const response = await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: replyId,
      snippet: {
        textOriginal: text
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || "Nao foi possivel editar a resposta no YouTube.");
  }
  return data as { id?: string };
}

async function recoverInstagramCommentId(
  service: Awaited<ReturnType<typeof googleRequestContext>>["service"],
  organizationId: string,
  accessToken: string,
  comment: CommentRow
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

async function createInstagramReply(
  request: Request,
  context: Awaited<ReturnType<typeof googleRequestContext>>,
  comment: CommentRow,
  responseText: string
) {
  const metaContext = await metaRequestContext(request);
  const connection = await getInstagramConnection(metaContext);
  let cleanExternalId = stripKnownCommentPrefix("instagram", String(comment.external_id || ""));

  try {
    await validateInstagramComment(connection.access_token, cleanExternalId);
    const reply = await replyToInstagramComment(connection.access_token, cleanExternalId, responseText);
    return { externalReplyId: reply.id ?? "", actionExternalId: `instagram:${cleanExternalId}` };
  } catch (firstError) {
    if (!isRecoverableInstagramActionError(firstError)) throw firstError;
    const recoveredId = await recoverInstagramCommentId(
      context.service,
      context.organizationId,
      connection.access_token,
      comment
    ).catch(() => "");
    if (!recoveredId) throw new Error(friendlyInstagramReplyError());
    cleanExternalId = recoveredId;
    try {
      await validateInstagramComment(connection.access_token, cleanExternalId);
      const reply = await replyToInstagramComment(connection.access_token, cleanExternalId, responseText);
      return { externalReplyId: reply.id ?? "", actionExternalId: `instagram:${cleanExternalId}` };
    } catch {
      throw new Error(friendlyInstagramReplyError());
    }
  }
}

async function recoverReplyIdFromEvents(
  context: Awaited<ReturnType<typeof googleRequestContext>>,
  comment: CommentRow,
  source: CommentSource
) {
  const { data, error } = await context.service
    .from("comment_webhook_events")
    .select("payload")
    .eq("organization_id", context.organizationId)
    .eq("source", source)
    .eq("event_type", "reply_sent")
    .eq("external_comment_id", String(comment.external_id || ""))
    .order("processed_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw error;
  const payload = (data?.[0]?.payload ?? {}) as Record<string, unknown>;
  return sanitizeText(payload.externalReplyId);
}

export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof googleRequestContext>> | null = null;
  let commentId = "";
  try {
    const body = await request.json().catch(() => ({}));
    commentId = String(body.commentId || "").trim();
    const responseText = sanitizeText(body.response);
    const mode = body.mode === "edit" ? "edit" : "create";
    const kind: ReplyKind = body.kind === "additional" ? "additional" : "primary";

    if (!commentId) return NextResponse.json({ error: "commentId obrigatorio." }, { status: 400 });
    if (!responseText) return NextResponse.json({ error: "Resposta obrigatoria." }, { status: 400 });
    if (responseText.length > 5000) return NextResponse.json({ error: "Resposta muito longa." }, { status: 400 });

    context = await googleRequestContext(request);
    const { data: comment, error } = await context.service
      .from("comments")
      .select("id,organization_id,source,external_id,video_id,video_title,author_name,text,response,response_external_id,response_history,bank_question_id")
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

    if (mode === "edit" && kind !== "primary") {
      return NextResponse.json({ error: "Somente a resposta principal pode ser editada." }, { status: 400 });
    }

    if (mode === "edit" && source !== "youtube") {
      return NextResponse.json(
        { error: source === "instagram" ? "O Instagram nao permite editar respostas ja publicadas pela integracao. Envie outra mensagem." : "Esta plataforma nao permite editar respostas pelo app." },
        { status: 400 }
      );
    }

    const history = normalizeHistory(comment.response_history);
    const now = new Date().toISOString();
    let externalReplyId = "";
    let actionExternalId = externalId;
    let nextHistory = history;
    const updatePayload: Record<string, unknown> = {
      processed_at: now
    };

    if (mode === "edit") {
      externalReplyId = sanitizeText(comment.response_external_id) || await recoverReplyIdFromEvents(context, comment, source);
      if (!externalReplyId) {
        return NextResponse.json(
          { error: "Nao encontrei o ID da resposta publicada no canal. Nao e possivel editar essa resposta antiga." },
          { status: 400 }
        );
      }
      const token = await getGoogleAccessToken(context, "youtube");
      const edited = await editYouTubeComment(token, externalReplyId, responseText);
      externalReplyId = edited.id || externalReplyId;
      nextHistory = withEditedPrimaryHistory(history, source, responseText, externalReplyId, now);
      updatePayload.response = responseText;
      updatePayload.response_external_id = externalReplyId;
      updatePayload.response_history = nextHistory;
      updatePayload.status = "respondido";
    } else {
      if (source === "youtube") {
        const token = await getGoogleAccessToken(context, "youtube");
        const reply = await replyToYouTubeComment(token, stripKnownCommentPrefix("youtube", externalId), responseText);
        externalReplyId = reply.id ?? "";
      } else if (source === "instagram") {
        const reply = await createInstagramReply(request, context, comment, responseText);
        externalReplyId = reply.externalReplyId;
        actionExternalId = reply.actionExternalId;
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

      nextHistory = withCreatedHistory(history, source, kind, responseText, externalReplyId, now);
      updatePayload.response_history = nextHistory;
      updatePayload.status = "respondido";
      if (kind === "primary") {
        updatePayload.response = responseText;
        updatePayload.response_external_id = externalReplyId || null;
      }
    }

    const { data: updated, error: updateError } = await context.service
      .from("comments")
      .update(updatePayload)
      .eq("organization_id", context.organizationId)
      .eq("id", commentId)
      .select("*")
      .maybeSingle();
    if (updateError) throw updateError;

    // Sincroniza a dúvida vinculada (Banco de Dúvidas) com a resposta principal.
    // Vínculo via bank_question_id (caso já exista) ou, como fallback, via external_id
    // (mesma chave usada na criação da dúvida) — sempre a partir do que já está no banco,
    // nunca refazendo chamada à API do canal.
    let updatedQuestion: Record<string, unknown> | null = null;
    if (kind === "primary") {
      let linkedQuestionId = comment.bank_question_id as string | null;

      if (!linkedQuestionId && externalId) {
        const { data: matched } = await context.service
          .from("customer_questions")
          .select("id")
          .eq("organization_id", context.organizationId)
          .eq("external_id", externalId)
          .maybeSingle();
        linkedQuestionId = matched?.id ?? null;

        if (linkedQuestionId) {
          await context.service
            .from("comments")
            .update({ bank_question_id: linkedQuestionId })
            .eq("organization_id", context.organizationId)
            .eq("id", commentId);
        }
      }

      if (linkedQuestionId) {
        const { error: questionUpdateError } = await context.service
          .from("customer_questions")
          .update({
            answer_text: responseText,
            status: "respondido",
            answered_at: now
          })
          .eq("organization_id", context.organizationId)
          .eq("id", linkedQuestionId);
        if (questionUpdateError) throw questionUpdateError;

        // Backfill do nome do vídeo/post só se a dúvida ainda não tiver um.
        if (comment.video_title) {
          await context.service
            .from("customer_questions")
            .update({ video_title: comment.video_title })
            .eq("organization_id", context.organizationId)
            .eq("id", linkedQuestionId)
            .is("video_title", null);
        }

        const { data: questionRow } = await context.service
          .from("customer_questions")
          .select("*")
          .eq("organization_id", context.organizationId)
          .eq("id", linkedQuestionId)
          .maybeSingle();
        updatedQuestion = questionRow ?? null;
      }
    }

    await recordCommentWebhookEvent(context.service, {
      organizationId: context.organizationId,
      source,
      eventId: externalReplyId || `${commentId}:${Date.now()}`,
      externalCommentId: actionExternalId,
      externalMediaId: String(comment.video_id || ""),
      eventType: mode === "edit" ? "reply_edited" : "reply_sent",
      payload: { commentId, externalId: actionExternalId, externalReplyId, response: responseText, mode, kind },
      processedAt: now
    });

    return NextResponse.json({ ok: true, externalReplyId, comment: updated, question: updatedQuestion });
  } catch (error) {
    if (context) {
      await recordDiagnostic(context.service, {
        organizationId: context.organizationId,
        provider: "youtube",
        service: "comments",
        error,
        category: "comentarios",
        severity: "erro",
        eventKey: `comentarios:resposta:${commentId || "desconhecido"}`,
        title: "Falha ao enviar resposta para comentário",
        profileId: context.userId,
        targetKind: "comment",
        targetId: commentId || undefined,
        metadata: { operation: "responder" }
      }).catch(() => undefined);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao responder comentario." },
      { status: 400 }
    );
  }
}
