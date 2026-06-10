import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { commentServiceClient, getDefaultOrganizationId, recordCommentWebhookEvent, upsertServerComments, type ServerCommentInput } from "@/lib/comment-server";
import { fetchInstagramCommentById } from "@/lib/meta-server";

type MetaConnection = {
  id: string;
  organization_id: string;
  instagram_account_id: string;
  access_token: string;
};

function verifyToken() {
  return process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "";
}

function metaAppSecret() {
  return process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || "";
}

function safeText(value: unknown) {
  return String(value ?? "").trim();
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
  } catch (error) {
    console.warn("[instagram-webhook:diagnostic]", error instanceof Error ? error.message : error);
  }
}

function verifySignature(rawBody: string, signatureHeader: string | null) {
  const secret = metaAppSecret();
  if (!secret || !signatureHeader) return true;
  const [algo, signature] = signatureHeader.split("=");
  if (algo !== "sha256" || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function getConnections() {
  const service = commentServiceClient();
  const { data, error } = await service
    .from("meta_connections")
    .select("id,organization_id,instagram_account_id,access_token")
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
  const commentId = safeText(value.comment_id || value.id || value.comment?.id);
  const mediaId = safeText(value.media_id || value.media?.id || value.post_id || value.video_id);
  const text = safeText(value.text || value.comment?.text || value.message);
  const authorName = safeText(value.from?.username || value.from?.name || value.username || "Instagram");
  const publishedAt = value.created_time
    ? new Date(Number(value.created_time) * 1000).toISOString()
    : safeText(value.timestamp || new Date().toISOString());
  const eventId = safeText(value.id || value.comment_id || change?.field || entry?.time || crypto.randomUUID());

  return { value, commentId, mediaId, text, authorName, publishedAt, eventId, payload };
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
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    await recordInstagramDiagnostic({
      eventType: "webhook_signature_invalid",
      error: "Assinatura Meta invalida.",
      payload: { hasSignature: Boolean(request.headers.get("x-hub-signature-256")) }
    });
    return NextResponse.json({ error: "Assinatura Meta invalida." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody || "{}");
    await recordInstagramDiagnostic({
      eventType: "webhook_post_received",
      processedAt: new Date().toISOString(),
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
            externalCommentId: event.commentId ? `instagram:${event.commentId.replace(/^instagram:/, "")}` : undefined,
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

        await recordCommentWebhookEvent(service, {
          organizationId: connection.organization_id,
          source: "instagram",
          eventId: event.eventId,
          externalCommentId: event.commentId ? `instagram:${event.commentId.replace(/^instagram:/, "")}` : undefined,
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
          comment = {
            source: "instagram" as const,
            externalId: `instagram:${event.commentId.replace(/^instagram:/, "")}`,
            videoId: event.mediaId,
            videoTitle: "Post Instagram",
            authorName: event.authorName,
            text: event.text,
            likes: Number(event.value.like_count || 0),
            publishedAt: event.publishedAt
          };
        } else if (event.commentId) {
          const fetched = await fetchInstagramCommentById(connection.access_token, event.commentId, event.mediaId).catch(async (error) => {
            await recordCommentWebhookEvent(service, {
              organizationId: connection.organization_id,
              source: "instagram",
              eventId: `${event.eventId}:fetch_failed`,
              externalCommentId: `instagram:${event.commentId.replace(/^instagram:/, "")}`,
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
              authorName: fetched.authorName,
              text: fetched.text,
              likes: fetched.likes,
              publishedAt: fetched.publishedAt
            };
          }
        }

        if (comment?.text) {
          await upsertServerComments(service, connection.organization_id, [comment]);
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
              hasText: Boolean(comment.text)
            },
            processedAt: new Date().toISOString()
          });
        } else {
          await recordCommentWebhookEvent(service, {
            organizationId: connection.organization_id,
            source: "instagram",
            eventId: `${event.eventId}:no_comment`,
            externalCommentId: event.commentId ? `instagram:${event.commentId.replace(/^instagram:/, "")}` : undefined,
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
    await recordInstagramDiagnostic({
      eventType: "webhook_error",
      error: error instanceof Error ? error.message : "Erro ao processar webhook do Instagram."
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao processar webhook do Instagram." },
      { status: 400 }
    );
  }
}
