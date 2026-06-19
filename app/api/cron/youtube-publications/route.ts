import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGoogleAccessToken } from "@/lib/google-server";
import type { GoogleRequestContext } from "@/lib/google-server";
import { createMetricAfterPublish } from "@/lib/post-metrics-server";
import { syncPostStatusFromPublications } from "@/lib/post-status-server";
import { upsertInternalNotifications } from "@/lib/notifications-server";

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

  // Busca publicações YouTube agendadas (privadas) ou em upload ainda não confirmadas
  const { data: publications, error } = await service
    .from("post_publications")
    .select("id, organization_id, post_id, external_id, title, format, attempts")
    .eq("platform", "youtube")
    .eq("status", "scheduled")
    .not("external_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!publications?.length) return NextResponse.json({ ok: true, processed: 0, results: [] });

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const pub of publications as PublicationRow[]) {
    const attempts = (pub.attempts ?? 0) + 1;
    try {
      // Busca token YouTube da organização (com refresh automático)
      const context: GoogleRequestContext = {
        service,
        userId: "cron",
        organizationId: pub.organization_id,
        role: "admin",
        active: true
      };
      const ytToken = await getGoogleAccessToken(context, "youtube");

      // Verifica status do vídeo na API do YouTube
      const verifyRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=status&id=${pub.external_id}`,
        { headers: { Authorization: `Bearer ${ytToken}` } }
      );
      if (!verifyRes.ok) throw new Error(`YouTube API error: ${verifyRes.status}`);

      const verifyData = await verifyRes.json() as {
        items?: { status: { privacyStatus: string; uploadStatus: string } }[]
      };
      const item = verifyData.items?.[0];
      if (!item) {
        const now = new Date().toISOString();
        const message = "Video nao encontrado no YouTube.";
        await service.from("post_publications").update({
          status: "error",
          error: message,
          attempts,
          last_attempt_at: now,
          updated_at: now,
        }).eq("id", pub.id);
        await syncPostStatusFromPublications(service, {
          organizationId: pub.organization_id,
          postId: pub.post_id
        });
        await upsertInternalNotifications(service, {
          organizationId: pub.organization_id,
          recipientMode: "admins_managers",
          title: "Publicação do YouTube com erro",
          description: `${pub.title || "Publicação"}: ${message}`,
          category: "publications",
          priority: "critical",
          source: "youtube",
          eventKey: `publication:youtube:error:${pub.id}`,
          targetKind: "publication",
          targetId: pub.id,
          actionLabel: "Abrir publicação",
          metadata: { postId: pub.post_id, publicationId: pub.id, externalId: pub.external_id }
        }).catch(() => {});
        results.push({ id: pub.id, status: "error", error: message });
        continue;
      }

      const { privacyStatus, uploadStatus } = item.status;

      if (privacyStatus === "public" && uploadStatus === "processed") {
        const now = new Date().toISOString();
        await service.from("post_publications").update({
          status: "published",
          published_at: now,
          error: null,
          attempts,
          last_attempt_at: now,
          updated_at: now,
        }).eq("id", pub.id);

        await syncPostStatusFromPublications(service, {
          organizationId: pub.organization_id,
          postId: pub.post_id,
          publishedAt: now
        });

        try {
          await createMetricAfterPublish(service, {
            organizationId: pub.organization_id,
            platform: "youtube",
            externalId: `yt:${pub.external_id}`,
            postId: pub.post_id,
            postTitle: pub.title,
            permalink: `https://www.youtube.com/watch?v=${pub.external_id}`,
            publishedAt: now,
            format: pub.format,
          });
        } catch {
          // Falha na métrica não reverte a publicação
        }

        await upsertInternalNotifications(service, {
          organizationId: pub.organization_id,
          recipientMode: "admins_managers",
          title: "YouTube publicado",
          description: pub.title || "Publicação confirmada pela API do YouTube.",
          category: "publications",
          priority: "normal",
          source: "youtube",
          eventKey: `publication:youtube:published:${pub.id}`,
          targetKind: "publication",
          targetId: pub.id,
          actionLabel: "Abrir post",
          metadata: { postId: pub.post_id, publicationId: pub.id, externalId: pub.external_id }
        }).catch(() => {});
        results.push({ id: pub.id, status: "published" });
      } else if (uploadStatus === "failed" || uploadStatus === "rejected" || privacyStatus === "rejected") {
        const now = new Date().toISOString();
        const message = `YouTube recusou a publicacao (${privacyStatus}/${uploadStatus}).`;
        await service.from("post_publications").update({
          status: "error",
          error: message,
          attempts,
          last_attempt_at: now,
          updated_at: now,
        }).eq("id", pub.id);
        await syncPostStatusFromPublications(service, {
          organizationId: pub.organization_id,
          postId: pub.post_id
        });
        await upsertInternalNotifications(service, {
          organizationId: pub.organization_id,
          recipientMode: "admins_managers",
          title: "Publicação do YouTube recusada",
          description: `${pub.title || "Publicação"}: ${message}`,
          category: "publications",
          priority: "critical",
          source: "youtube",
          eventKey: `publication:youtube:error:${pub.id}`,
          targetKind: "publication",
          targetId: pub.id,
          actionLabel: "Abrir publicação",
          metadata: { postId: pub.post_id, publicationId: pub.id, externalId: pub.external_id }
        }).catch(() => {});
        results.push({ id: pub.id, status: "error", error: message });
      } else {
        // Ainda agendado/processando — atualiza apenas o attempt
        await service.from("post_publications").update({
          attempts,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", pub.id);
        results.push({ id: pub.id, status: `waiting (${privacyStatus}/${uploadStatus})` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao verificar vídeo no YouTube.";
      await service.from("post_publications").update({
        status: "error",
        error: message,
        attempts,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", pub.id);
      await syncPostStatusFromPublications(service, {
        organizationId: pub.organization_id,
        postId: pub.post_id
      });
      await upsertInternalNotifications(service, {
        organizationId: pub.organization_id,
        recipientMode: "admins_managers",
        title: "Erro ao verificar YouTube",
        description: `${pub.title || "Publicação"}: ${message}`,
        category: "publications",
        priority: "critical",
        source: "youtube",
        eventKey: `publication:youtube:error:${pub.id}`,
        targetKind: "publication",
        targetId: pub.id,
        actionLabel: "Abrir publicação",
        metadata: { postId: pub.post_id, publicationId: pub.id, externalId: pub.external_id }
      }).catch(() => {});
      results.push({ id: pub.id, status: "error", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export const POST = GET;
