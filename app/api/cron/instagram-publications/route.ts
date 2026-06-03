import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Receiver } from "@upstash/qstash";
import { getMetaConnection, type MetaRequestContext } from "@/lib/meta-server";
import { publishInstagramMedia } from "@/lib/instagram-publish-server";
import { createMetricAfterPublish } from "@/lib/post-metrics-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type QStashBody = {
  publicationId: string;
};

function shouldUseInstagramCaption(format?: string | null) {
  return format === "Feed" || format === "Reels";
}

function shouldUseInstagramThumbnail(format?: string | null) {
  return format === "Reels";
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

export async function GET() {
  return NextResponse.json({ ok: true, message: "Agendamento de Stories via QStash ativo." });
}

async function processPublication(publicationId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 500 });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

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

  if (publication.status !== "scheduled") {
    return NextResponse.json({ ok: true, message: "Publicacao sem agendamento ativo." });
  }

  const attempts = (publication.attempts ?? 0) + 1;

  try {
    await service
      .from("post_publications")
      .update({ status: "processing", attempts, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", publicationId);

    const connection = await getMetaConnection(service, publication.organization_id, "instagram");
    if (!connection?.access_token || !connection.instagram_account_id) {
      throw new Error("Instagram/Meta nao conectado para esta organizacao.");
    }

    const context: MetaRequestContext = {
      service,
      userId: publication.created_by ?? "qstash",
      organizationId: publication.organization_id,
      role: "admin",
      active: true
    };

    const published = await publishInstagramMedia(context, connection, {
      assetUrl: publication.asset_url,
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
        updated_at: new Date().toISOString()
      })
      .eq("id", publicationId);

    if (publication.post_id) {
      await service
        .from("posts")
        .update({ status: "Publicado", published_at: published.publishedAt })
        .eq("organization_id", publication.organization_id)
        .eq("id", publication.post_id);
    }

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

    return NextResponse.json({ ok: true, status: "published", permalink: published.permalink });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao publicar Story no Instagram.";
    await service
      .from("post_publications")
      .update({ status: "error", error: message, attempts, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", publicationId);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
