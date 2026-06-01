import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getInstagramConnection, metaRequestContext } from "@/lib/meta-server";
import { publishInstagramMedia, scheduleInstagramMedia } from "@/lib/instagram-publish-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type PublishBody = {
  postId?: string;
  assetUrl?: string;
  title?: string;
  caption?: string;
  format?: string;
  scheduledAt?: string | null;
  thumbnailUrl?: string | null;
  allowDuplicate?: boolean;
};

function parseScheduledAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data de agendamento invalida.");
  }
  // Mínimo 10 minutos no futuro (requisito da Meta para agendamento nativo)
  return date.getTime() > Date.now() + 10 * 60_000 ? date : null;
}

export async function POST(request: Request) {
  try {
    const context = await metaRequestContext(request);
    const body = await request.json().catch(() => ({})) as PublishBody;

    if (!body.assetUrl) {
      return NextResponse.json({ error: "Selecione uma arte aprovada para publicar no Instagram." }, { status: 400 });
    }

    const connection = await getInstagramConnection(context);
    const scheduledAt = parseScheduledAt(body.scheduledAt);

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
          .maybeSingle();
        if (existingError) throw new Error(existingError.message);
        if (existing) {
          return NextResponse.json(
            { error: "Este post ja tem uma publicacao do Instagram registrada. Confirme a duplicacao para publicar novamente.", publicationId: existing.id },
            { status: 409 }
          );
        }
      }

      // Agendamento nativo Meta: cria container com published=false + scheduled_publish_time
      const scheduled = await scheduleInstagramMedia(context, connection, {
        assetUrl: body.assetUrl,
        title: body.title,
        caption: body.caption,
        format: body.format ?? "Feed",
        thumbnailUrl: body.thumbnailUrl ?? null
      }, scheduledAt);

      const publication = {
        id: randomUUID(),
        organization_id: context.organizationId,
        post_id: body.postId,
        platform: "instagram",
        status: "scheduled",
        title: body.title ?? "",
        caption: body.caption ?? "",
        format: scheduled.effectiveFormat,
        asset_url: body.assetUrl,
        thumbnail_url: body.thumbnailUrl ?? null,
        external_id: scheduled.containerId,
        scheduled_at: scheduledAt.toISOString(),
        attempts: 0,
        created_by: context.userId,
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await context.service.from("post_publications").insert(publication);
      if (insertError) throw new Error(insertError.message);

      await context.service
        .from("posts")
        .update({ status: "Agendado" })
        .eq("organization_id", context.organizationId)
        .eq("id", body.postId);

      return NextResponse.json({
        status: "scheduled",
        publicationId: publication.id,
        scheduledAt: publication.scheduled_at,
        effectiveFormat: scheduled.effectiveFormat,
        contentType: scheduled.contentType
      });
    }

    if (!body.allowDuplicate && body.postId) {
      const { data: existing, error: existingError } = await context.service
        .from("post_publications")
        .select("id,status,permalink")
        .eq("organization_id", context.organizationId)
        .eq("post_id", body.postId)
        .eq("platform", "instagram")
        .eq("status", "published")
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
      assetUrl: body.assetUrl,
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
        caption: body.caption ?? "",
        format: result.effectiveFormat,
        asset_url: body.assetUrl,
        thumbnail_url: body.thumbnailUrl ?? null,
        external_id: result.instagramMediaId,
        permalink: result.permalink,
        published_at: result.publishedAt,
        attempts: 1,
        created_by: context.userId,
        updated_at: new Date().toISOString()
      });
      if (insertError) throw new Error(insertError.message);

      await context.service
        .from("posts")
        .update({ status: "Publicado", published_at: result.publishedAt })
        .eq("organization_id", context.organizationId)
        .eq("id", body.postId);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[meta/instagram/publish]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao publicar no Instagram." },
      { status: 500 }
    );
  }
}
