import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { importMetaAdsChunk } from "@/lib/meta-ads-server";
import { recordDiagnostic } from "@/lib/api-errors";
import type { MetaRequestContext } from "@/lib/meta-server";

export const dynamic = "force-dynamic";
export const maxDuration = 280;

// Para de pegar jobs novos apos esse orcamento, deixando margem antes do
// maxDuration — o resto fica pendente para a proxima chamada do cron externo.
const TIME_BUDGET_MS = 250000;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}` && !isVercelCron) {
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

  const startedAt = Date.now();
  const results: Array<{ id: string; status: string; error?: string }> = [];

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const { data: jobs, error } = await service
      .from("meta_ads_import_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const job = jobs?.[0];
    if (!job) break;

    const startTimestamp = new Date().toISOString();
    await service
      .from("meta_ads_import_jobs")
      .update({ status: "processing", started_at: startTimestamp, updated_at: startTimestamp })
      .eq("id", job.id)
      .eq("status", "pending");

    try {
      const context: MetaRequestContext = {
        userId: job.created_by || "cron",
        organizationId: job.organization_id,
        role: "admin",
        active: true,
        service
      };
      const result = await importMetaAdsChunk(context, { since: job.since_date, until: job.until_date });
      const completedAt = new Date().toISOString();
      await service
        .from("meta_ads_import_jobs")
        .update({
          status: "done",
          result_accounts: result.accounts,
          result_campaigns: result.campaigns,
          result_ad_sets: result.adSets,
          result_ads: result.ads,
          result_insights: result.insights,
          completed_at: completedAt,
          updated_at: completedAt
        })
        .eq("id", job.id);
      results.push({ id: job.id, status: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido no import Meta Ads.";
      const failedAt = new Date().toISOString();
      const attempts = (job.attempts ?? 0) + 1;
      await service
        .from("meta_ads_import_jobs")
        .update({
          status: "failed",
          error_message: message,
          attempts,
          completed_at: failedAt,
          updated_at: failedAt
        })
        .eq("id", job.id);
      await recordDiagnostic(service, {
        organizationId: job.organization_id,
        provider: "meta_ads",
        service: "meta_ads",
        error: message,
        category: "fila",
        severity: "erro",
        eventKey: `fila:meta_ads_import:${job.id}`,
        title: "Falha ao importar lote de Meta Ads",
        targetKind: "meta_ads_import_job",
        targetId: job.id,
        metadata: { batchId: job.batch_id, sinceDate: job.since_date, untilDate: job.until_date }
      }).catch(() => undefined);
      results.push({ id: job.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export const POST = GET;
