import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Receiver } from "@upstash/qstash";
import { getMetaConnection, type MetaRequestContext } from "@/lib/meta-server";
import {
  cleanupPublicationAssets,
  createInstagramAsyncContainer,
  getInstagramContainerStatus,
  instagramContainerErrorMessage,
  publishInstagramCreation,
  publishInstagramMedia,
  type InstagramPublishConnection
} from "@/lib/instagram-publish-server";
import { createMetricAfterPublish } from "@/lib/post-metrics-server";
import { syncPostStatusFromPublications } from "@/lib/post-status-server";
import { recordDiagnostic } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type QStashBody = {
  publicationId: string;
};

const MAX_ATTEMPTS = 3;
const PROCESSING_STALE_MS = 15 * 60 * 1000;
const CONTAINER_POLL_DELAY_MS = 60 * 1000;
const BATCH_LIMIT = 5;

function shouldUseInstagramCaption(format?: string | null) {
  return format === "Feed" || format === "Reels";
}

function shouldUseInstagramThumbnail(format?: string | null) {
  return format === "Reels";
}

function toTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

function isStaleProcessing(publication: any) {
  if (publication.status !== "processing") return false;
  const lastAttempt = toTime(publication.last_attempt_at) || toTime(publication.updated_at) || toTime(publication.created_at);
  return !lastAttempt || Date.now() - lastAttempt > PROCESSING_STALE_MS;
}

function isDueTime(value?: string | null) {
  const time = toTime(value);
  return !time || time <= Date.now();
}

function nextPollAt() {
  return new Date(Date.now() + CONTAINER_POLL_DELAY_MS).toISOString();
}

function shouldUseAsyncInstagramFlow(publication: any) {
  if (publication.instagram_creation_id || publication.processing_stage) return true;
  return String(publication.format || "").toLowerCase().includes("reel");
}

function isDueAsyncProcessing(publication: any) {
  return publication.status === "processing" &&
    Boolean(publication.instagram_creation_id) &&
    isDueTime(publication.next_attempt_at);
}

function instagramQueueFieldsReset() {
  return {
    processing_stage: null,
    instagram_creation_id: null,
    prepared_asset_url: null,
    prepared_content_type: null,
    meta_status: null,
    next_attempt_at: null,
    last_heartbeat_at: new Date().toISOString()
  };
}

async function recordInstagramPublicationDiagnostic(service: any, publication: any, error: unknown, severity: "aviso" | "erro" | "critico") {
  await recordDiagnostic(service, {
    organizationId: publication.organization_id,
    provider: "instagram",
    service: "instagram",
    error,
    category: "publicacao",
    severity,
    eventKey: `publicacao:instagram:agendada:${publication.id}`,
    title: "Falha na publicação agendada do Instagram",
    targetKind: "publication",
    targetId: publication.id,
    metadata: { postId: publication.post_id, stage: publication.processing_stage ?? null, attempts: publication.attempts ?? 0 }
  });
}

export async function POST(request: Request) {
  // Verificar assinatura do QStash
  const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (signingKey && nextSigningKey) {
    const receiver = new Receiver({ currentSigningKey: signingKey, nextSigningKey });
    const rawBody = await request.text();
    try {
      await receiver.verify({ signature: request.headers.get("upstash-signature") ?? "", body: rawBody });
    } catch {
      return NextResponse.json({ error: "Assinatura QStash invalida." }, { status: 401 });
    }
    try {
      const body = JSON.parse(rawBody) as QStashBody;
      return await processPublication(body.publicationId);
    } catch {
      return NextResponse.json({ error: "Body invalido." }, { status: 400 });
    }
  }

  // Fallback: chamada direta sem QStash (para testes locais)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as Partial<QStashBody>;
  if (!body.publicationId) return NextResponse.json({ error: "publicationId obrigatorio." }, { status: 400 });
  return await processPublication(body.publicationId);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}` && !isVercelCron) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  return await processDuePublications();
}

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase nao configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function processDuePublications() {
  let service: any;
  try {
    service = createServiceClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase nao configurado." }, { status: 500 });
  }

  const { data, error } = await service
    .from("post_publications")
    .select("id,status,scheduled_at,next_attempt_at,last_attempt_at,updated_at,created_at,instagram_creation_id,processing_stage")
    .eq("platform", "instagram")
    .in("status", ["scheduled", "processing"])
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (data ?? [])
    .filter((publication: any) => {
      if (publication.status === "scheduled") return isDueTime(publication.scheduled_at);
      return isDueAsyncProcessing(publication) || isStaleProcessing(publication);
    })
    .slice(0, BATCH_LIMIT);

  const results = [];
  for (const publication of due) {
    const response = await processPublication(publication.id);
    const body = await response.json().catch(() => ({}));
    results.push({ publicationId: publication.id, status: response.status, ...body });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

async function processPublication(publicationId: string) {
  let service: any;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 500 });
  }

  const { data: publication, error: fetchError } = await service
    .from("post_publications")
    .select("*")
    .eq("id", publicationId)
    .eq("platform", "instagram")
    .maybeSingle();

  if (fetchError || !publication) {
    return NextResponse.json({ error: "Publicacao nao encontrada." }, { status: 404 });
  }

  if (publication.status === "published") {
    return NextResponse.json({ ok: true, message: "Ja publicado." });
  }

  if (publication.status === "cancelled") {
    return NextResponse.json({ ok: true, message: "Publicacao cancelada." });
  }

  if ((publication.status === "scheduled" || publication.status === "processing") && !isDueTime(publication.scheduled_at)) {
    return NextResponse.json({
      ok: true,
      status: "not_due",
      message: "Publicacao reagendada para o futuro.",
      scheduledAt: publication.scheduled_at
    });
  }

  const canProcess =
    publication.status === "scheduled" ||
    isDueAsyncProcessing(publication) ||
    isStaleProcessing(publication);

  if (!canProcess) {
    if (publication.status === "processing") {
      return NextResponse.json({ ok: true, message: "Publicacao ainda em processamento.", status: "processing" });
    }
    return NextResponse.json({ ok: true, message: "Publicacao sem agendamento ativo." });
  }

  const currentAttempts = Number(publication.attempts ?? 0);
  const isAsyncFlow = shouldUseAsyncInstagramFlow(publication);
  const hasAsyncContainer = Boolean(publication.instagram_creation_id);
  const attempts = hasAsyncContainer ? currentAttempts : currentAttempts + 1;

  if (!hasAsyncContainer && attempts > MAX_ATTEMPTS) {
    const errorMessage = "Publicacao do Instagram excedeu o limite de tentativas apos timeout/processamento.";
    await service
      .from("post_publications")
      .update({
        status: "error",
        error: errorMessage,
        attempts,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", publicationId);
    await syncPostStatusFromPublications(service, {
      organizationId: publication.organization_id,
      postId: publication.post_id
    });
    await recordInstagramPublicationDiagnostic(service, publication, errorMessage, "critico").catch(() => undefined);
    return NextResponse.json({ error: errorMessage, attempts }, { status: 500 });
  }

  try {
    const connection = await getMetaConnection(service, publication.organization_id, "instagram");
    if (!connection?.access_token || !connection.instagram_account_id) {
      throw new Error("Instagram/Meta nao conectado para esta organizacao.");
    }
    const publishConnection: InstagramPublishConnection = {
      access_token: connection.access_token,
      instagram_account_id: connection.instagram_account_id,
      scopes: connection.scopes
    };

    const context: MetaRequestContext = {
      service,
      userId: publication.created_by ?? "qstash",
      organizationId: publication.organization_id,
      role: "admin",
      active: true
    };

    if (isAsyncFlow) {
      if (!publication.instagram_creation_id) {
        await service
          .from("post_publications")
          .update({
            status: "processing",
            processing_stage: "creating_container",
            attempts,
            last_attempt_at: new Date().toISOString(),
            last_heartbeat_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", publicationId);

        const container = await createInstagramAsyncContainer(context, publishConnection, {
          assetUrl: publication.asset_url,
          carouselAssets: Array.isArray(publication.carousel_assets) ? publication.carousel_assets : [],
          title: publication.title ?? "",
          caption: shouldUseInstagramCaption(publication.format) ? (publication.caption ?? "") : "",
          format: publication.format ?? "Story",
          thumbnailUrl: shouldUseInstagramThumbnail(publication.format) ? publication.thumbnail_url : null
        });

        await service
          .from("post_publications")
          .update({
            status: "processing",
            processing_stage: "container_created",
            instagram_creation_id: container.creationId,
            prepared_asset_url: container.preparedAssetUrl,
            prepared_content_type: container.preparedContentType,
            format: container.effectiveFormat,
            meta_status: "CREATED",
            next_attempt_at: nextPollAt(),
            last_heartbeat_at: new Date().toISOString(),
            error: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", publicationId);

        return NextResponse.json({
          ok: true,
          status: "processing",
          processingStage: "container_created",
          creationId: container.creationId,
          nextAttemptAt: nextPollAt()
        });
      }

      const containerStatus = await getInstagramContainerStatus(publishConnection, publication.instagram_creation_id);
      const now = new Date().toISOString();

      if (containerStatus.statusCode === "ERROR" || containerStatus.statusCode === "EXPIRED") {
        const message = instagramContainerErrorMessage(containerStatus);
        if (currentAttempts >= MAX_ATTEMPTS) {
          await service
            .from("post_publications")
            .update({
              status: "error",
              processing_stage: "container_error",
              meta_status: containerStatus.statusCode,
              error: message,
              last_heartbeat_at: now,
              updated_at: now
            })
            .eq("id", publicationId);
          await syncPostStatusFromPublications(service, {
            organizationId: publication.organization_id,
            postId: publication.post_id
          });
          await recordInstagramPublicationDiagnostic(service, publication, message, "critico").catch(() => undefined);
          return NextResponse.json({ error: message, attempts: currentAttempts }, { status: 500 });
        }

        await service
          .from("post_publications")
          .update({
            status: "scheduled",
            processing_stage: "retry_scheduled",
            instagram_creation_id: null,
            meta_status: containerStatus.statusCode,
            error: message,
            next_attempt_at: nextPollAt(),
            last_heartbeat_at: now,
            updated_at: now
          })
          .eq("id", publicationId);
        await recordInstagramPublicationDiagnostic(service, publication, message, "aviso").catch(() => undefined);
        return NextResponse.json({ ok: true, status: "retry_scheduled", error: message, nextAttemptAt: nextPollAt() });
      }

      if (containerStatus.statusCode !== "FINISHED") {
        await service
          .from("post_publications")
          .update({
            processing_stage: "container_processing",
            meta_status: containerStatus.statusCode || "IN_PROGRESS",
            next_attempt_at: nextPollAt(),
            last_heartbeat_at: now,
            updated_at: now
          })
          .eq("id", publicationId);
        return NextResponse.json({
          ok: true,
          status: "processing",
          processingStage: "container_processing",
          metaStatus: containerStatus.statusCode || "IN_PROGRESS",
          nextAttemptAt: nextPollAt()
        });
      }

      const published = await publishInstagramCreation(
        publishConnection,
        publication.instagram_creation_id,
        publication.format ?? "Reels",
        publication.prepared_content_type ?? "video/mp4"
      );

      await service
        .from("post_publications")
        .update({
          status: "published",
          processing_stage: "published",
          meta_status: "FINISHED",
          format: published.effectiveFormat,
          external_id: published.instagramMediaId,
          permalink: published.permalink,
          published_at: published.publishedAt,
          error: null,
          next_attempt_at: null,
          last_heartbeat_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", publicationId);

      await syncPostStatusFromPublications(service, {
        organizationId: publication.organization_id,
        postId: publication.post_id,
        publishedAt: published.publishedAt
      });

      try {
        await createMetricAfterPublish(service, {
          organizationId: publication.organization_id,
          platform: "instagram",
          externalId: `instagram:${published.instagramMediaId}`,
          postId: publication.post_id,
          postTitle: publication.title,
          permalink: published.permalink,
          publishedAt: published.publishedAt ?? new Date().toISOString(),
          format: published.effectiveFormat,
        });
      } catch {
        // Falha na metrica nao reverte a publicacao
      }

      await cleanupPublicationAssets(service, {
        assetUrl: publication.asset_url,
        carouselAssets: Array.isArray(publication.carousel_assets) ? publication.carousel_assets : [],
        thumbnailUrl: publication.thumbnail_url
      });

      return NextResponse.json({ ok: true, status: "published", permalink: published.permalink });
    }

    await service
      .from("post_publications")
      .update({ status: "processing", attempts, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", publicationId);

    const published = await publishInstagramMedia(context, publishConnection, {
      assetUrl: publication.asset_url,
      carouselAssets: Array.isArray(publication.carousel_assets) ? publication.carousel_assets : [],
      title: publication.title ?? "",
      caption: shouldUseInstagramCaption(publication.format) ? (publication.caption ?? "") : "",
      format: publication.format ?? "Story",
      thumbnailUrl: shouldUseInstagramThumbnail(publication.format) ? publication.thumbnail_url : null
    });

    await service
      .from("post_publications")
      .update({
        status: "published",
        format: published.effectiveFormat,
        external_id: published.instagramMediaId,
        permalink: published.permalink,
        published_at: published.publishedAt,
        error: null,
        ...instagramQueueFieldsReset(),
        updated_at: new Date().toISOString()
      })
      .eq("id", publicationId);

    await syncPostStatusFromPublications(service, {
      organizationId: publication.organization_id,
      postId: publication.post_id,
      publishedAt: published.publishedAt
    });

    try {
      await createMetricAfterPublish(service, {
        organizationId: publication.organization_id,
        platform: "instagram",
        externalId: `instagram:${published.instagramMediaId}`,
        postId: publication.post_id,
        postTitle: publication.title,
        permalink: published.permalink,
        publishedAt: published.publishedAt ?? new Date().toISOString(),
        format: published.effectiveFormat,
      });
    } catch {
      // Falha na métrica não reverte a publicação
    }

    await cleanupPublicationAssets(service, {
      assetUrl: publication.asset_url,
      carouselAssets: Array.isArray(publication.carousel_assets) ? publication.carousel_assets : [],
      thumbnailUrl: publication.thumbnail_url
    });

    return NextResponse.json({ ok: true, status: "published", permalink: published.permalink });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao publicar Story no Instagram.";

    // "Failed to decrypt" e um erro intermitente conhecido do lado da Meta
    // (graph.instagram.com) — tenta novamente automaticamente algumas vezes
    // antes de marcar como erro definitivo.
    const isTransientMetaError = /failed to decrypt/i.test(message);
    const maxAttempts = 3;

    if (isTransientMetaError && attempts < maxAttempts) {
      await service
        .from("post_publications")
        .update({ status: "scheduled", error: message, attempts, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", publicationId);

      const qstashToken = process.env.QSTASH_TOKEN;
      if (qstashToken) {
        const { Client: QStashClient } = await import("@upstash/qstash");
        const qstash = new QStashClient({ token: qstashToken });
        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
        await qstash.publishJSON({
          url: `${siteUrl}/api/cron/instagram-publications`,
          body: { publicationId },
          delay: 60
        });
      }

      return NextResponse.json({ ok: true, status: "retry_scheduled", attempts, error: message });
    }

    await service
      .from("post_publications")
      .update({ status: "error", error: message, attempts, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", publicationId);
    if (publication) {
      await syncPostStatusFromPublications(service, {
        organizationId: publication.organization_id,
        postId: publication.post_id
      });
    }
    if (publication) await recordInstagramPublicationDiagnostic(service, publication, message, "critico").catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
