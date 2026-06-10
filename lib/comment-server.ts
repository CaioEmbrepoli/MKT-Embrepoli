import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CommentSource = "youtube" | "instagram" | "facebook" | "tiktok";

export type CommentExternalReplyInput = {
  id: string;
  authorName: string;
  text: string;
  publishedAt: string;
  likes?: number;
  isOwnReply?: boolean;
};

export type ServerCommentInput = {
  source: CommentSource;
  externalId?: string;
  importSignature?: string;
  videoId?: string;
  videoTitle?: string;
  mediaThumbnailUrl?: string;
  mediaUrl?: string;
  mediaPermalink?: string;
  authorName: string;
  text: string;
  likes?: number;
  externalReplies?: CommentExternalReplyInput[];
  response?: string;
  status?: "novo" | "respondido" | "ignorado";
  addedToBank?: boolean;
  bankQuestionId?: string;
  publishedAt?: string;
  retentionUntil?: string;
  processedAt?: string;
  isRelevant?: boolean;
  classificationStatus?: "pendente" | "relevante" | "normal" | "erro";
  classificationReason?: string;
  suggestedReply?: string;
};

type ExistingCommentRow = {
  id: string;
  source: CommentSource;
  external_id: string | null;
  import_signature: string | null;
  retention_until: string | null;
  created_at: string | null;
  response: string | null;
  status: "novo" | "respondido" | "ignorado" | null;
  media_thumbnail_url: string | null;
  media_url: string | null;
  media_permalink: string | null;
  external_replies: CommentExternalReplyInput[] | null;
  added_to_bank: boolean | null;
  bank_question_id: string | null;
  classification_status: "pendente" | "relevante" | "normal" | "erro" | null;
  suggested_reply: string | null;
  is_relevant: boolean | null;
};

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase nao configurado para comentarios.");
  return { url, serviceKey };
}

export function commentServiceClient() {
  const { url, serviceKey } = supabaseEnv();
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function getDefaultOrganizationId(service: SupabaseClient) {
  const configured = process.env.DEFAULT_ORGANIZATION_ID?.trim();
  if (configured) return configured;

  const { data, error } = await service
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Nenhuma organizacao encontrada para processar comentarios.");
  return String(data.id);
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

function normalizeCommentText(value: string) {
  return sanitizeText(value).toLowerCase().replace(/\s+/g, " ").slice(0, 500);
}

function normalizeExternalReplies(value: unknown): CommentExternalReplyInput[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, CommentExternalReplyInput>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = sanitizeText(row.id);
    const text = sanitizeText(row.text);
    if (!id || !text) continue;
    byId.set(id, {
      id,
      authorName: sanitizeText(row.authorName) || "Instagram",
      text,
      publishedAt: sanitizeText(row.publishedAt) || new Date().toISOString(),
      likes: Number(row.likes ?? 0),
      isOwnReply: Boolean(row.isOwnReply)
    });
  }
  return Array.from(byId.values());
}

export function stripKnownCommentPrefix(source: CommentSource, externalId: string) {
  if (source === "youtube") return externalId.replace(/^yt_comment:/, "");
  if (source === "instagram") return externalId.replace(/^instagram:/, "");
  if (source === "tiktok") return externalId.replace(/^tiktok:/, "");
  if (source === "facebook") return externalId.replace(/^facebook:/, "");
  return externalId;
}

export function buildCommentSignature(comment: Pick<ServerCommentInput, "source" | "videoId" | "authorName" | "text" | "publishedAt">) {
  const raw = [
    comment.source,
    comment.videoId ?? "",
    sanitizeText(comment.authorName).toLowerCase(),
    normalizeCommentText(comment.text),
    comment.publishedAt ?? ""
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function addDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeComment(comment: ServerCommentInput): ServerCommentInput {
  const source = comment.source;
  const externalId = comment.externalId?.trim() || undefined;
  const normalized: ServerCommentInput = {
    ...comment,
    source,
    externalId,
    importSignature: comment.importSignature?.trim() || buildCommentSignature(comment),
    videoId: sanitizeText(comment.videoId),
    videoTitle: sanitizeText(comment.videoTitle),
    mediaThumbnailUrl: comment.mediaThumbnailUrl ? sanitizeText(comment.mediaThumbnailUrl) : undefined,
    mediaUrl: comment.mediaUrl ? sanitizeText(comment.mediaUrl) : undefined,
    mediaPermalink: comment.mediaPermalink ? sanitizeText(comment.mediaPermalink) : undefined,
    authorName: sanitizeText(comment.authorName) || "Cliente",
    text: sanitizeText(comment.text),
    externalReplies: normalizeExternalReplies(comment.externalReplies),
    response: comment.response ? sanitizeText(comment.response) : undefined,
    suggestedReply: comment.suggestedReply ? sanitizeText(comment.suggestedReply) : undefined,
    likes: Number(comment.likes ?? 0),
    status: comment.status ?? (comment.response ? "respondido" : "novo"),
    addedToBank: Boolean(comment.addedToBank),
    classificationStatus: comment.classificationStatus ?? "pendente"
  };
  return normalized;
}

function mapCommentForUpsert(organizationId: string, comment: ServerCommentInput, existing?: ExistingCommentRow) {
  const createdAt = existing?.created_at ?? new Date().toISOString();
  const retentionUntil = existing?.retention_until ?? comment.retentionUntil ?? addDaysIso(90);
  const response = existing?.response ?? comment.response ?? null;
  const status = existing?.status === "respondido" || response ? "respondido" : (comment.status ?? "novo");
  const addedToBank = Boolean(existing?.added_to_bank || comment.addedToBank);
  const bankQuestionId = existing?.bank_question_id ?? comment.bankQuestionId ?? null;
  const classificationStatus = existing?.classification_status && existing.classification_status !== "pendente"
    ? existing.classification_status
    : (comment.classificationStatus ?? "pendente");

  return {
    id: existing?.id ?? crypto.randomUUID(),
    organization_id: organizationId,
    source: comment.source,
    external_id: comment.externalId ?? null,
    import_signature: comment.importSignature ?? null,
    video_id: comment.videoId || null,
    video_title: comment.videoTitle || null,
    author_name: comment.authorName,
    text: comment.text,
    likes: Number(comment.likes ?? 0),
    response,
    status,
    media_thumbnail_url: comment.mediaThumbnailUrl ?? existing?.media_thumbnail_url ?? null,
    media_url: comment.mediaUrl ?? existing?.media_url ?? null,
    media_permalink: comment.mediaPermalink ?? existing?.media_permalink ?? null,
    external_replies: comment.externalReplies?.length ? comment.externalReplies : (existing?.external_replies ?? []),
    added_to_bank: addedToBank,
    bank_question_id: bankQuestionId,
    published_at: comment.publishedAt || null,
    retention_until: retentionUntil,
    processed_at: comment.processedAt ?? null,
    is_relevant: existing?.is_relevant ?? comment.isRelevant ?? null,
    classification_status: classificationStatus,
    classification_reason: comment.classificationReason ?? null,
    suggested_reply: existing?.suggested_reply ?? comment.suggestedReply ?? null,
    created_at: createdAt
  };
}

export async function upsertServerComments(service: SupabaseClient, organizationId: string, items: ServerCommentInput[]) {
  const normalized = items.map(normalizeComment).filter((item) => item.text);
  if (!normalized.length) return [];

  const externalIds = Array.from(new Set(normalized.map((c) => c.externalId).filter((id): id is string => Boolean(id))));
  const signatures = Array.from(new Set(normalized.map((c) => c.importSignature).filter((id): id is string => Boolean(id))));
  const existingRows: ExistingCommentRow[] = [];

  if (externalIds.length) {
    const { data, error } = await service
      .from("comments")
      .select("id,source,external_id,import_signature,retention_until,created_at,response,status,media_thumbnail_url,media_url,media_permalink,external_replies,added_to_bank,bank_question_id,classification_status,suggested_reply,is_relevant")
      .eq("organization_id", organizationId)
      .in("external_id", externalIds);
    if (error) throw error;
    existingRows.push(...((data ?? []) as ExistingCommentRow[]));
  }

  if (signatures.length) {
    const { data, error } = await service
      .from("comments")
      .select("id,source,external_id,import_signature,retention_until,created_at,response,status,media_thumbnail_url,media_url,media_permalink,external_replies,added_to_bank,bank_question_id,classification_status,suggested_reply,is_relevant")
      .eq("organization_id", organizationId)
      .in("import_signature", signatures);
    if (error) throw error;
    existingRows.push(...((data ?? []) as ExistingCommentRow[]));
  }

  const existingByExternal = new Map(existingRows.filter((row) => row.external_id).map((row) => [`${row.source}:${row.external_id}`, row]));
  const existingBySignature = new Map(existingRows.filter((row) => row.import_signature).map((row) => [`${row.source}:${row.import_signature}`, row]));
  const rows = normalized.map((comment) => {
    const existing = (comment.externalId ? existingByExternal.get(`${comment.source}:${comment.externalId}`) : undefined)
      ?? (comment.importSignature ? existingBySignature.get(`${comment.source}:${comment.importSignature}`) : undefined);
    return mapCommentForUpsert(organizationId, comment, existing);
  });

  const { data, error } = await service
    .from("comments")
    .upsert(rows, { onConflict: "id" })
    .select("*");
  if (error) throw error;
  return data ?? [];
}

export async function deleteServerCommentByExternalId(
  service: SupabaseClient,
  organizationId: string,
  source: CommentSource,
  externalId: string
) {
  const { data, error } = await service
    .from("comments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("source", source)
    .eq("external_id", externalId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

export async function updateServerCommentResponseByExternalId(
  service: SupabaseClient,
  organizationId: string,
  source: CommentSource,
  externalId: string,
  response: string
) {
  const { data, error } = await service
    .from("comments")
    .update({
      response: sanitizeText(response),
      status: "respondido",
      processed_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("source", source)
    .eq("external_id", externalId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function appendServerCommentExternalReply(
  service: SupabaseClient,
  organizationId: string,
  source: CommentSource,
  externalId: string,
  reply: CommentExternalReplyInput
) {
  const normalizedReply = normalizeExternalReplies([reply])[0];
  if (!normalizedReply) return null;

  const { data: existing, error: selectError } = await service
    .from("comments")
    .select("id,external_replies")
    .eq("organization_id", organizationId)
    .eq("source", source)
    .eq("external_id", externalId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!existing?.id) return null;

  const replies = normalizeExternalReplies(existing.external_replies);
  const nextReplies = [
    normalizedReply,
    ...replies.filter((item) => item.id !== normalizedReply.id)
  ];

  const { data, error } = await service
    .from("comments")
    .update({ external_replies: nextReplies })
    .eq("id", existing.id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateServerCommentResponse(
  service: SupabaseClient,
  organizationId: string,
  commentId: string,
  response: string
) {
  const { data, error } = await service
    .from("comments")
    .update({
      response: sanitizeText(response),
      status: "respondido",
      processed_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("id", commentId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function recordCommentWebhookEvent(
  service: SupabaseClient,
  input: {
    organizationId: string;
    source: CommentSource;
    eventId?: string;
    externalCommentId?: string;
    externalMediaId?: string;
    eventType: string;
    payload: unknown;
    processedAt?: string | null;
    error?: string | null;
  }
) {
  const row = {
    organization_id: input.organizationId,
    source: input.source,
    event_id: input.eventId ?? null,
    external_comment_id: input.externalCommentId ?? null,
    external_media_id: input.externalMediaId ?? null,
    event_type: input.eventType,
    payload: input.payload ?? {},
    processed_at: input.processedAt ?? null,
    error: input.error ?? null
  };

  const query = input.eventId
    ? service.from("comment_webhook_events").upsert(row, { onConflict: "organization_id,source,event_id" })
    : service.from("comment_webhook_events").insert(row);
  const { error } = await query;
  if (error) {
    console.warn("comment_webhook_events unavailable:", error.message);
  }
}
