import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMetaConnection, type MetaRequestContext } from "@/lib/meta-server";
import { publishInstagramMedia } from "@/lib/instagram-publish-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type PublicationRow = {
  id: string;
  organization_id: string;
  post_id: string | null;
  title: string | null;
  caption: string | null;
  format: string | null;
  asset_url: string;
  thumbnail_url: string | null;
  attempts: number | null;
  created_by: string | null;
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase service role nao configurado." }, { status: 500 });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const now = new Date().toISOString();
  const { data: publications, error } = await service
    .from("post_publications")
    .select("*")
    .eq("platform", "instagram")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!publications?.length) return NextResponse.json({ ok: true, processed: 0, results: [] });

  const results: Array<{ id: string; status: string; error?: string; permalink?: string }> = [];

  for (const publication of publications as PublicationRow[]) {
    const attempts = (publication.attempts ?? 0) + 1;
    try {
      await service
        .from("post_publications")
        .update({ status: "processing", attempts, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", publication.id);

      const context: MetaRequestContext = {
        service,
        userId: publication.created_by ?? "cron",
        organizationId: publication.organization_id,
        role: "admin",
        active: true
      };
      const connection = await getMetaConnection(service, publication.organization_id, "instagram");
      if (!connection?.access_token || !connection.instagram_account_id) {
        throw new Error("Instagram/Meta nao conectado para esta organizacao.");
      }

      const published = await publishInstagramMedia(context, connection, {
        assetUrl: publication.asset_url,
        title: publication.title ?? "",
        caption: publication.caption ?? "",
        format: publication.format ?? "Feed",
        thumbnailUrl: publication.thumbnail_url
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
        .eq("id", publication.id);

      if (publication.post_id) {
        await service
          .from("posts")
          .update({ status: "Publicado", published_at: published.publishedAt })
          .eq("organization_id", publication.organization_id)
          .eq("id", publication.post_id);
      }

      results.push({ id: publication.id, status: "published", permalink: published.permalink });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao publicar no Instagram.";
      await service
        .from("post_publications")
        .update({ status: "error", error: message, attempts, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", publication.id);
      results.push({ id: publication.id, status: "error", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export const POST = GET;
