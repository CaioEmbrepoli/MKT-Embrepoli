import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { appendServerCommentExternalReply, commentServiceClient, createServerQuestionsFromComments, deleteServerCommentByExternalId, getDefaultOrganizationId, recordCommentWebhookEvent, updateServerCommentResponseByExternalId, upsertServerComments, type ServerCommentInput } from "@/lib/comment-server";
import { fetchInstagramCommentById, fetchInstagramMediaById } from "@/lib/meta-server";
import { recordDiagnostic } from "@/lib/api-errors";

type MetaConnection = {
  id: string;
  organization_id: string;
  instagram_account_id: string;
  username: string | null;
  access_token: string;
};

function verifyToken() {
  return process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "";
}

function metaAppSecrets() {
  return [
    process.env.META_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

function configuredSecretNames() {
  return [
    process.env.META_APP_SECRET ? "META_APP_SECRET" : "",
    process.env.INSTAGRAM_APP_SECRET ? "INSTAGRAM_APP_SECRET" : ""
  ].filter(Boolean);
}

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = String((error as { message: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

function instagramExternalCommentId(commentId: string) {
  const cleanId = safeText(commentId).replace(/^(instagram:)+/i, "");
  return cleanId ? `instagram:${cleanId}` : "";
}

function normalizeInstagramTimestamp(value: unknown) {
  const raw = safeText(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeInstagramCreatedTime(value: unknown) {
  const raw = safeText(value);
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds * 1000).toISOString();
  }
  return normalizeInstagramTimestamp(raw);
}

function normalizeInstagramUsername(value: unknown) {
  return safeText(value).replace(/^@+/, "").toLowerCase();
}

function isOwnInstagramActor(value: any, connection: MetaConnection) {
  const actorId = safeText(value?.from?.id || value?.user_id || value?.owner?.id);
  const actorUsername = normalizeInstagramUsername(value?.from?.username || value?.from?.name || value?.username);
  const connectionUsername = normalizeInstagramUsername(connection.username);
  return Boolean(
    (actorId && actorId === connection.instagram_account_id) ||
    (actorUsername && connectionUsername && actorUsername === connectionUsername)
  );
}

function hasInstagramActor(value: any) {
  return Boolean(
    safeText(value?.from?.id || value?.user_id || value?.owner?.id) ||
    normalizeInstagramUsername(value?.from?.username || value?.from?.name || value?.username)
  );
}

function isDeleteEvent(value: any, change: any) {
  const parts = [
    value?.verb,
    value?.action,
    value?.event_type,
    value?.type,
    value?.item,
    change?.field
  ].map((item) => safeText(item).toLowerCase()).filter(Boolean);
  return parts.some((part) => part.includes("delete") || part.includes("remove") || part === "removed");
}

async function recordInstagramDiagnostic(input: {
  eventType: string;
  eventId?: string;
  organizationId?: string;
  externalCommentId?: string;
  externalMediaId?: string;
  processedAt?: string | null;
  error?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    const service = commentServiceClient();
    const organizationId = input.organizationId ?? await getDefaultOrganizationId(service);
    await recordCommentWebhookEvent(service, {
      organizationId,
      source: "instagram",
      eventId: input.eventId,
      externalCommentId: input.externalCommentId,
      externalMediaId: input.externalMediaId,
      eventType: input.eventType,
      payload: input.payload ?? {},
      processedAt: input.processedAt,
      error: input.error
    });
    if (input.error) {
      await recordDiagnostic(service, {
        organizationId,
        provider: "instagram",
        service: "instagram",
        error: input.error,
        category: "webhook",
        severity: "erro",
        eventKey: `webhook:instagram:${input.eventType}:${input.externalCommentId ?? input.eventId ?? "geral"}`,
        title: "Falha no webhook de comentários do Instagram",
        targetKind: "webhook",
        targetId: input.externalCommentId ?? input.eventId,
        metadata: { eventType: input.eventType, mediaId: input.externalMediaId ?? null }
      });
    }
  } catch (error) {
    console.warn("[instagram-webhook:diagnostic]", error instanceof Error ? error.message : error);
  }
}

function verifySignature(rawBody: string, signatureHeader: string | null) {
  const secrets = Array.from(new Set(metaAppSecrets()));
  if (!secrets.length || !signatureHeader) return true;
  const [algo, signature] = signatureHeader.split("=");
  if (algo !== "sha256" || !signature) return false;
  const actualBuffer = Buffer.from(signature);
  return secrets.some((secret) => {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

async function getConnections() {
  const service = commentServiceClient();
  const { data, error } = await service
    .from("meta_connections")
    .select("id,organization_id,instagram_account_id,username,access_token")
    .eq("service", "instagram");
  if (error) throw error;
  return { service, connections: (data ?? []) as MetaConnection[] };
}

function pickConnection(connections: MetaConnection[], entry: any, value: any) {
  const ids = new Set([
    safeText(entry?.id),
    safeText(value?.instagram_id),
    safeText(value?.ig_user_id),
    safeText(value?.media?.owner?.id)
  ].filter(Boolean));
  return connections.find((connection) => ids.has(connection.instagram_account_id)) ?? connections[0] ?? null;
}

function extractCommentEvent(payload: any, entry: any, change: any) {
  const value = change?.value ?? {};
  const valueId = safeText(value.id || value.comment?.id);
  const valueCommentId = safeText(value.comment_id);
  const commentId = safeText(valueId || valueCommentId);
  const parentCommentId = safeText(
    value.parent_id ||
    value.parent_comment_id ||
    value.parent?.id ||
    value.comment?.parent_id ||
    value.comment?.parent?.id ||
    (valueId && valueCommentId && valueId !== valueCommentId ? valueCommentId : "")
  );
  const mediaId = safeText(value.media_id || value.media?.id || value.post_id || value.video_id);
  const text = safeText(value.text || value.comment?.text || value.message);
  const authorName = safeText(value.from?.username || value.from?.name || value.username || "Instagram");
  const authorAvatarUrl = safeText(value.from?.profile_picture_url || value.profile_picture_url);
  const publishedAt = normalizeInstagramCreatedTime(value.created_time) ?? normalizeInstagramTimestamp(value.timestamp);
  const eventId = safeText(value.id || value.comment_id || change?.field || entry?.time || crypto.randomUUID());

  return { value, commentId, parentCommentId, mediaId, text, authorName, authorAvatarUrl, publishedAt, eventId, payload };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === verifyToken()) {
    await recordInstagramDiagnostic({
      eventType: "webhook_verify_ok",
      processedAt: new Date().toISOString(),
      payload: { mode, hasChallenge: Boolean(challenge) }
    });
    return new Response(challenge ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  await recordInstagramDiagnostic({
    eventType: "webhook_verify_failed",
    error: "Token de verificacao invalido.",
    payload: { mode, hasToken: Boolean(token), hasChallenge: Boolean(challenge) }
  });
  return NextResponse.json({ error: "Token de verificacao invalido." }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const receivedAt = new Date().toISOString();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    await recordInstagramDiagnostic({
      eventType: "webhook_signature_invalid",
      error: "Assinatura Meta invalida.",
      payload: {
        hasSignature: Boolean(request.headers.get("x-hub-signature-256")),
        configuredSecretNames: configuredSecretNames()
      }
    });
    return NextResponse.json({ error: "Assinatura Meta invalida." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody || "{}");
    await recordInstagramDiagnostic({
      eventType: "webhook_post_received",
      processedAt: receivedAt,
      payload: {
        object: safeText(payload.object),
        entryCount: Array.isArray(payload.entry) ? payload.entry.length : 0
      }
    });

    const { service, connections } = await getConnections();
    let processed = 0;
    let storedEvents = 0;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const event = extractCommentEvent(payload, entry, change);
        const connection = pickConnection(connections, entry, event.value);
        if (!connection) {
          await recordInstagramDiagnostic({
            eventType: "webhook_connection_not_found",
            eventId: event.eventId,
            externalCommentId: event.commentId ? instagramExternalCommentId(event.commentId) : undefined,
            externalMediaId: event.mediaId,
            error: "Nenhuma conexao Instagram encontrada para o evento.",
            payload: {
              field: safeText(change?.field || "comment"),
              entryId: safeText(entry?.id),
              hasCommentId: Boolean(event.commentId),
              hasText: Boolean(event.text)
            }
          });
          storedEvents += 1;
          continue;
        }

        if (event.commentId && isDeleteEvent(event.value, change)) {
          const externalCommentId = instagramExternalCommentId(event.commentId);
          const deleted = await deleteServerCommentByExternalId(service, connection.organization_id, "instagram", externalCommentId);
          await recordCommentWebhookEvent(service, {
            organizationId: connection.organization_id,
            source: "instagram",
            eventId: `${event.eventId}:delete`,
            externalCommentId,
            externalMediaId: event.mediaId,
            eventType: deleted ? "comment_deleted" : "comment_delete_not_found",
            payload: {
              field: safeText(change?.field || "comment"),
              verb: safeText(event.value?.verb),
              action: safeText(event.value?.action),
              eventType: safeText(event.value?.event_type || event.value?.type),
              item: safeText(event.value?.item)
            },
            processedAt: deleted ? new Date().toISOString() : null,
            error: deleted ? null : "Comentario de Instagram nao encontrado para remover."
          });
          storedEvents += 1;
          processed += deleted ? 1 : 0;
          continue;
        }

        if (event.parentCommentId && event.commentId && event.text) {
          const parentExternalId = instagramExternalCommentId(event.parentCommentId);
          const replyExternalId = instagramExternalCommentId(event.commentId);
          const hasActor = hasInstagramActor(event.value);
          const isOwnReply = hasActor && isOwnInstagramActor(event.value, connection);
          let updated = null;
          if (!event.publishedAt) {
            await recordCommentWebhookEvent(service, {
              organizationId: connection.organization_id,
              source: "instagram",
              eventId: `${event.eventId}:reply_missing_timestamp`,
              externalCommentId: parentExternalId,
              externalMediaId: event.mediaId,
              eventType: "comment_reply_missing_timestamp",
              payload: {
                field: safeText(change?.field || "comment"),
                replyId: replyExternalId,
                hasCreatedTime: Boolean(event.value?.created_time),
                hasTimestamp: Boolean(event.value?.timestamp)
              },
              processedAt: null,
              error: "Reply do Instagram recebido sem timestamp confiavel."
            });
            storedEvents += 1;
          }
          if (isOwnReply) {
            updated = await updateServerCommentResponseByExternalId(
              service,
              connection.organization_id,
              "instagram",
              parentExternalId,
              event.text,
              replyExternalId
            );
          } else {
            updated = await appendServerCommentExternalReply(
              service,
              connection.organization_id,
              "instagram",
              parentExternalId,
              {
                id: replyExternalId,
                authorName: event.authorName,
                authorAvatarUrl: event.authorAvatarUrl || undefined,
                text: event.text,
                publishedAt: event.publishedAt ?? receivedAt,
                likes: Number(event.value.like_count || 0),
                isOwnReply: false
              }
            );
          }
          await recordCommentWebhookEvent(service, {
            organizationId: connection.organization_id,
            source: "instagram",
            eventId: `${event.eventId}:reply`,
            externalCommentId: parentExternalId,
            externalMediaId: event.mediaId,
            eventType: updated
              ? (isOwnReply ? "comment_reply_own_processed" : (hasActor ? "comment_reply_external_processed" : "comment_reply_external_processed_uncertain"))
              : "comment_reply_parent_not_found",
            payload: {
              field: safeText(change?.field || "comment"),
              replyId: replyExternalId,
              authorName: event.authorName,
              hasActor,
              isOwnReply,
              hasText: Boolean(event.text)
            },
            processedAt: updated ? new Date().toISOString() : null,
            error: updated ? null : "Comentario pai nao encontrado para registrar reply."
          });
          storedEvents += 1;
          processed += updated ? 1 : 0;
          continue;
        }

        await recordCommentWebhookEvent(service, {
          organizationId: connection.organization_id,
          source: "instagram",
          eventId: event.eventId,
          externalCommentId: event.commentId ? instagramExternalCommentId(event.commentId) : undefined,
          externalMediaId: event.mediaId,
          eventType: safeText(change?.field || "comment"),
          payload: {
            field: safeText(change?.field || "comment"),
            entryId: safeText(entry?.id),
            hasCommentId: Boolean(event.commentId),
            hasText: Boolean(event.text)
          },
          processedAt: null
        });
        storedEvents += 1;

        let comment: ServerCommentInput | null = null;
        if (event.commentId && event.text) {
          let fetchedComment: Awaited<ReturnType<typeof fetchInstagramCommentById>> | null = null;
          if (!event.publishedAt) {
            fetchedComment = await fetchInstagramCommentById(connection.access_token, event.commentId, event.mediaId).catch(async (error) => {
              await recordCommentWebhookEvent(service, {
                organizationId: connection.organization_id,
                source: "instagram",
                eventId: `${event.eventId}:timestamp_fetch_failed`,
                externalCommentId: instagramExternalCommentId(event.commentId),
                externalMediaId: event.mediaId,
                eventType: "comment_timestamp_fetch_failed",
                payload: {
                  hasCommentId: true,
                  hasText: true,
                  field: safeText(change?.field || "comment")
                },
                processedAt: null,
                error: error instanceof Error ? error.message : "Erro ao buscar horario do comentario do Instagram."
              });
              storedEvents += 1;
              return null;
            });
            await recordCommentWebhookEvent(service, {
              organizationId: connection.organization_id,
              source: "instagram",
              eventId: `${event.eventId}:timestamp_resolution`,
              externalCommentId: instagramExternalCommentId(event.commentId),
              externalMediaId: fetchedComment?.videoId || event.mediaId,
              eventType: fetchedComment?.publishedAt ? "comment_timestamp_recovered" : "comment_timestamp_received_at_fallback",
              payload: {
                hasCreatedTime: Boolean(event.value?.created_time),
                hasTimestamp: Boolean(event.value?.timestamp),
                fetchedTimestamp: Boolean(fetchedComment?.publishedAt),
                fallback: fetchedComment?.publishedAt ? null : "webhook_received_at"
              },
              processedAt: fetchedComment?.publishedAt ? new Date().toISOString() : null,
              error: fetchedComment?.publishedAt ? null : "Meta nao retornou timestamp do comentario; usando horario de recebimento do webhook."
            });
            storedEvents += 1;
          }
          const media = fetchedComment
            ? null
            : event.mediaId ? await fetchInstagramMediaById(connection.access_token, event.mediaId) : null;
          comment = {
            source: "instagram" as const,
            externalId: fetchedComment?.commentId || instagramExternalCommentId(event.commentId),
            videoId: fetchedComment?.videoId || event.mediaId,
            videoTitle: fetchedComment?.videoTitle || "Post Instagram",
            mediaThumbnailUrl: fetchedComment?.mediaThumbnailUrl || media?.thumbnailUrl || media?.mediaUrl || undefined,
            mediaUrl: fetchedComment?.mediaUrl || media?.mediaUrl || undefined,
            mediaPermalink: fetchedComment?.mediaPermalink || media?.permalink || undefined,
            authorName: fetchedComment?.authorName || event.authorName,
            authorAvatarUrl: fetchedComment?.authorAvatarUrl || event.authorAvatarUrl || undefined,
            text: fetchedComment?.text || event.text,
            likes: Number(fetchedComment?.likes ?? event.value.like_count ?? 0),
            publishedAt: event.publishedAt ?? fetchedComment?.publishedAt ?? receivedAt
          };
        } else if (event.commentId) {
          const fetched = await fetchInstagramCommentById(connection.access_token, event.commentId, event.mediaId).catch(async (error) => {
            await recordCommentWebhookEvent(service, {
              organizationId: connection.organization_id,
              source: "instagram",
              eventId: `${event.eventId}:fetch_failed`,
              externalCommentId: instagramExternalCommentId(event.commentId),
              externalMediaId: event.mediaId,
              eventType: "comment_fetch_failed",
              payload: { hasCommentId: true, hasText: false },
              processedAt: null,
              error: error instanceof Error ? error.message : "Erro ao buscar comentario do Instagram."
            });
            storedEvents += 1;
            return null;
          });
          if (fetched) {
            comment = {
              source: "instagram",
              externalId: fetched.commentId,
              videoId: fetched.videoId,
              videoTitle: fetched.videoTitle,
              mediaThumbnailUrl: fetched.mediaThumbnailUrl,
              mediaUrl: fetched.mediaUrl,
              mediaPermalink: fetched.mediaPermalink,
              authorName: fetched.authorName,
              authorAvatarUrl: fetched.authorAvatarUrl,
              text: fetched.text,
              likes: fetched.likes,
              publishedAt: fetched.publishedAt
            };
          }
        }

        if (comment?.text) {
          if (!comment.publishedAt) {
            await recordCommentWebhookEvent(service, {
              organizationId: connection.organization_id,
              source: "instagram",
              eventId: `${event.eventId}:missing_timestamp`,
              externalCommentId: comment.externalId,
              externalMediaId: comment.videoId,
              eventType: "comment_missing_timestamp",
              payload: {
                hasCreatedTime: Boolean(event.value?.created_time),
                hasTimestamp: Boolean(event.value?.timestamp)
              },
              processedAt: null,
              error: "Comentario do Instagram recebido sem timestamp confiavel."
            });
            storedEvents += 1;
          }
          const upserted = await upsertServerComments(service, connection.organization_id, [comment]);
          const bankResult = await createServerQuestionsFromComments(service, connection.organization_id, upserted as Array<Record<string, any>>);
          processed += 1;
          await recordCommentWebhookEvent(service, {
            organizationId: connection.organization_id,
            source: "instagram",
            eventId: `${event.eventId}:processed`,
            externalCommentId: comment.externalId,
            externalMediaId: comment.videoId,
            eventType: "comment_processed",
            payload: {
              externalId: comment.externalId,
              videoId: comment.videoId,
              hasText: Boolean(comment.text),
              questionsCreated: bankResult.created
            },
            processedAt: new Date().toISOString()
          });
        } else {
          await recordCommentWebhookEvent(service, {
            organizationId: connection.organization_id,
            source: "instagram",
            eventId: `${event.eventId}:no_comment`,
            externalCommentId: event.commentId ? instagramExternalCommentId(event.commentId) : undefined,
            externalMediaId: event.mediaId,
            eventType: "comment_not_processed",
            payload: {
              field: safeText(change?.field || "comment"),
              hasCommentId: Boolean(event.commentId),
              hasText: Boolean(event.text)
            },
            processedAt: null,
            error: "Evento recebido sem comentario processavel."
          });
          storedEvents += 1;
        }
      }
    }

    return NextResponse.json({ received: true, storedEvents, processed });
  } catch (error) {
    const message = errorMessage(error, "Erro ao processar webhook do Instagram.");
    await recordInstagramDiagnostic({
      eventType: "webhook_error",
      error: message
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
