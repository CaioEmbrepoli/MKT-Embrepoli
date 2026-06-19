import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTikTokAccessToken } from "@/lib/tiktok-server";
import type { TikTokRequestContext } from "@/lib/tiktok-server";
import { createMetricAfterPublish } from "@/lib/post-metrics-server";
import { recordDiagnostic } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PublicationRow = {
  id: string;
  organization_id: string;
  post_id: string | null;
  external_id: string | null;
  title: string | null;
  format: string | null;
  attempts: number | null;
};

async function recordTikTokPublicationDiagnostic(service: any, publication: PublicationRow, error: unknown) {
  await recordDiagnostic(service, {
    organizationId: publication.organization_id,
    provider: "tiktok",
    service: "tiktok",
    error,
    category: "publicacao",
    severity: "critico",
    eventKey: `publicacao:tiktok:agendada:${publication.id}`,
    title: "Falha na publicação agendada do TikTok",
    targetKind: "publication",
    targetId: publication.id,
    metadata: { postId: publication.post_id, externalId: publication.external_id }
  });
}

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

  // Busca publicações TikTok ainda processando (últimas 48h para não poluir)
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: publications, error } = await service
    .from("post_publications")
    .select("id, organization_id, post_id, external_id, title, format, attempts")
    .eq("platform", "tiktok")
    .eq("status", "processing")
    .not("external_id", "is", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!publications?.length) return NextResponse.json({ ok: true, processed: 0, results: [] });

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const pub of publications as PublicationRow[]) {
    const attempts = (pub.attempts ?? 0) + 1;
    try {
      // Busca token TikTok da organização (com refresh automático)
      const context: TikTokRequestContext = {
        service,
        userId: "cron",
        organizationId: pub.organization_id,
        role: "admin",
        active: true
      };
      const accessToken = await getTikTokAccessToken(context);

      // Verifica status da publicação na API do TikTok
      const statusRes = await fetch(
        `https://open.tiktokapis.com/v2/post/publish/status/fetch/?publish_id=${pub.external_id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const statusData = await statusRes.json() as {
        data?: { status?: string; publicaly_available_post_id?: string[] };
        error?: { code?: string; message?: string };
      };

      if (!statusRes.ok || (statusData.error?.code && statusData.error.code !== "ok")) {
        throw new Error(statusData.error?.message ?? `TikTok API error: ${statusRes.status}`);
      }

      const tikStatus = statusData.data?.status ?? "";
      const videoId = statusData.data?.publicaly_available_post_id?.[0];
      const now = new Date().toISOString();

      if (tikStatus === "PUBLISH_COMPLETE") {
        await service.from("post_publications").update({
          status: "published",
          external_id: videoId ?? pub.external_id,
          permalink: videoId ? `https://www.tiktok.com/video/${videoId}` : null,
          published_at: now,
          error: null,
          attempts,
          last_attempt_at: now,
          updated_at: now,
        }).eq("id", pub.id);

        if (pub.post_id) {
          await service.from("posts")
            .update({ status: "Publicado", published_at: now })
            .eq("organization_id", pub.organization_id)
            .eq("id", pub.post_id);
        }

        const tiktokVideoId = videoId ?? pub.external_id;
        try {
          await createMetricAfterPublish(service, {
            organizationId: pub.organization_id,
            platform: "tiktok",
            externalId: `tiktok:${tiktokVideoId}`,
            postId: pub.post_id,
            postTitle: pub.title,
            permalink: tiktokVideoId ? `https://www.tiktok.com/video/${tiktokVideoId}` : null,
            publishedAt: now,
            format: pub.format,
          });
        } catch {
          // Falha na métrica não reverte a publicação
        }

        results.push({ id: pub.id, status: "published" });
      } else if (tikStatus === "FAILED") {
        await service.from("post_publications").update({
          status: "error",
          error: "TikTok reportou falha na publicação.",
          attempts,
          last_attempt_at: now,
          updated_at: now,
        }).eq("id", pub.id);
        await recordTikTokPublicationDiagnostic(service, pub, "TikTok reportou falha na publicação.").catch(() => undefined);
        results.push({ id: pub.id, status: "error", error: "FAILED" });
      } else {
        // PROCESSING_UPLOAD ou SEND_TO_USER_INBOX — aguarda próxima rodada
        await service.from("post_publications").update({
          attempts,
          last_attempt_at: now,
          updated_at: now,
        }).eq("id", pub.id);
        results.push({ id: pub.id, status: `waiting (${tikStatus})` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao verificar publicação no TikTok.";
      await service.from("post_publications").update({
        error: message,
        attempts,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", pub.id);
      await recordTikTokPublicationDiagnostic(service, pub, message).catch(() => undefined);
      results.push({ id: pub.id, status: "error", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export const POST = GET;
