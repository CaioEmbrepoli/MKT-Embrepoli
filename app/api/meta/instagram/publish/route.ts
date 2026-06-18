import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Client as QStashClient } from "@upstash/qstash";
import { recordIntegrationFailure, toApiErrorPayload } from "@/lib/api-errors";
import { getInstagramConnection, metaRequestContext, type MetaRequestContext } from "@/lib/meta-server";
import { publishInstagramMedia, scheduleInstagramMedia } from "@/lib/instagram-publish-server";
import { parseSaoPauloDateTime } from "@/lib/app-time";
import { createMetricAfterPublish } from "@/lib/post-metrics-server";
import { syncPostStatusFromPublications } from "@/lib/post-status-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type PublishBody = {
  postId?: string;
  assetUrl?: string;
  carouselAssets?: Array<{ assetUrl?: string; title?: string; order?: number }>;
  title?: string;
  caption?: string;
  format?: string;
  scheduledAt?: string | null;
  thumbnailUrl?: string | null;
  allowDuplicate?: boolean;
};

function normalizeCarouselAssets(value: PublishBody["carouselAssets"]) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      assetUrl: String(item?.assetUrl || "").trim(),
      title: String(item?.title || ""),
      order: Number.isFinite(Number(item?.order)) ? Number(item?.order) : index + 1
    }))
    .filter((item) => item.assetUrl)
    .sort((a, b) => a.order - b.order || a.assetUrl.localeCompare(b.assetUrl));
}

function parseScheduledAt(value?: string | null) {
  const date = parseSaoPauloDateTime(value);
  if (!date) return null;
  // Mínimo 10 minutos no futuro (requisito da Meta para agendamento nativo)
  return date.getTime() > Date.now() + 10 * 60_000 ? date : null;
}

function shouldPersistInstagramCaption(format?: string | null) {
  return format === "Feed" || format === "Reels";
}

function shouldPersistInstagramThumbnail(format?: string | null) {
  return format === "Reels";
}

export async function POST(request: Request) {
  let context: MetaRequestContext | null = null;
  try {
    context = await metaRequestContext(request);
    const body = await request.json().catch(() => ({})) as PublishBody;

    const connection = await getInstagramConnection(context);
    const scheduledAt = parseScheduledAt(body.scheduledAt);
    const carouselAssets = normalizeCarouselAssets(body.carouselAssets);
    const assetUrl = carouselAssets[0]?.assetUrl || body.assetUrl;

    if (!assetUrl) {
      return NextResponse.json({ error: "Selecione uma arte aprovada para publicar no Instagram." }, { status: 400 });
    }

    if (carouselAssets.length > 0 && body.format !== "Feed") {
      return NextResponse.json({ error: "Carrossel do Instagram so pode ser publicado como Feed." }, { status: 400 });
    }

    if (scheduledAt) {
      if (!body.postId) {
        return NextResponse.json({ error: "Post obrigatorio para agendar publicacao no Instagram." }, { status: 400 });
      }

      if (!body.allowDuplicate) {
        const { data: existing, error: existingError } = await context.service
          .from("post_publications")
          .select("id,status,scheduled_at")
          .eq("organization_id", context.organizationId)
          .eq("post_id", body.postId)
          .eq("platform", "instagram")
          .in("status", ["scheduled", "pending", "processing", "published"])
          .limit(1)
          .maybeSingle();
        if (existingError) throw new Error(existingError.message);
        if (existing) {
          return NextResponse.json(
            { error: "Este post ja tem uma publicacao do Instagram registrada. Confirme a duplicacao para publicar novamente.", publicationId: existing.id },
            { status: 409 }
          );
        }
      }

      // Todos os formatos usam QStash — agendamento nativo da Meta retorna code=1 para Feed/Reels
      const qstashToken = process.env.QSTASH_TOKEN;
      if (!qstashToken) throw new Error("QSTASH_TOKEN nao configurado. Adicione nas env vars da Vercel.");

      const fmt = body.format ?? "Feed";
      const publicationId = randomUUID();
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
      const callbackUrl = `${siteUrl}/api/cron/instagram-publications`;

      const { error: insertError } = await context.service.from("post_publications").insert({
        id: publicationId,
        organization_id: context.organizationId,
        post_id: body.postId,
        platform: "instagram",
        status: "scheduled",
        title: body.title ?? "",
        caption: shouldPersistInstagramCaption(fmt) ? (body.caption ?? "") : "",
        format: fmt,
        asset_url: assetUrl,
        carousel_assets: carouselAssets,
        thumbnail_url: shouldPersistInstagramThumbnail(fmt) ? (body.thumbnailUrl ?? null) : null,
        scheduled_at: scheduledAt.toISOString(),
        attempts: 0,
        created_by: context.userId,
        updated_at: new Date().toISOString()
      });
      if (insertError) throw new Error(insertError.message);

      const qstash = new QStashClient({ token: qstashToken });
      await qstash.publishJSON({
        url: callbackUrl,
        body: { publicationId },
        notBefore: Math.floor(scheduledAt.getTime() / 1000)
      });

      await syncPostStatusFromPublications(context.service, {
        organizationId: context.organizationId,
        postId: body.postId
      });

      return NextResponse.json({
        status: "scheduled",
        publicationId,
        scheduledAt: scheduledAt.toISOString(),
        effectiveFormat: fmt,
        contentType: carouselAssets.length ? "carousel" : "video/mp4"
      });
    }

    if (!body.allowDuplicate && body.postId) {
      const { data: existing, error: existingError } = await context.service
        .from("post_publications")
        .select("id,status,permalink")
        .eq("organization_id", context.organizationId)
        .eq("post_id", body.postId)
        .eq("platform", "instagram")
        .in("status", ["scheduled", "pending", "processing", "published"])
        .limit(1)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existing) {
        return NextResponse.json(
          { error: "Este post ja foi publicado no Instagram. Confirme a duplicacao para publicar novamente.", publicationId: existing.id, permalink: existing.permalink },
          { status: 409 }
        );
      }
    }

    const result = await publishInstagramMedia(context, connection, {
      assetUrl,
      carouselAssets,
      title: body.title,
      caption: body.caption,
      format: body.format ?? "Feed",
      thumbnailUrl: body.thumbnailUrl ?? null
    });

    if (body.postId) {
      const { error: insertError } = await context.service.from("post_publications").insert({
        id: randomUUID(),
        organization_id: context.organizationId,
        post_id: body.postId,
        platform: "instagram",
        status: "published",
        title: body.title ?? "",
        caption: shouldPersistInstagramCaption(result.effectiveFormat) ? (body.caption ?? "") : "",
        format: result.effectiveFormat,
        asset_url: assetUrl,
        carousel_assets: carouselAssets,
        thumbnail_url: shouldPersistInstagramThumbnail(result.effectiveFormat) ? (body.thumbnailUrl ?? null) : null,
        external_id: result.instagramMediaId,
        permalink: result.permalink,
        published_at: result.publishedAt,
        attempts: 1,
        created_by: context.userId,
        updated_at: new Date().toISOString()
      });
      if (insertError) throw new Error(insertError.message);

      await syncPostStatusFromPublications(context.service, {
        organizationId: context.organizationId,
        postId: body.postId,
        publishedAt: result.publishedAt
      });

      try {
        await createMetricAfterPublish(context.service, {
          organizationId: context.organizationId,
          platform: "instagram",
          externalId: `instagram:${result.instagramMediaId}`,
          postId: body.postId,
          postTitle: body.title,
          permalink: result.permalink,
          publishedAt: result.publishedAt ?? new Date().toISOString(),
          format: result.effectiveFormat,
        });
      } catch {
        // Falha na métrica não impede o retorno de sucesso
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[meta/instagram/publish]", error);
    const payload = toApiErrorPayload(error, { provider: "instagram", service: "instagram" });
    if (context) await recordIntegrationFailure(context.service, context.organizationId, payload);
    return NextResponse.json(payload, { status: 500 });
  }
}
