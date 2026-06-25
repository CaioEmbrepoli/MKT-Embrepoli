import { NextResponse } from "next/server";
import { metaRequestContext, type MetaRequestContext } from "@/lib/meta-server";

export const dynamic = "force-dynamic";

type JobStatus = "pending" | "processing" | "done" | "failed" | "canceled";

export async function GET(request: Request) {
  let context: MetaRequestContext;
  try {
    context = await metaRequestContext(request);
  } catch {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  const url = new URL(request.url);
  let batchId = url.searchParams.get("batchId");

  if (!batchId) {
    // Sem batchId: devolve o lote mais recente da organizacao (usado pelo
    // indicador de progresso fora do modal, que precisa achar o ultimo lote
    // sem o usuario precisar informar qual).
    const { data: latest, error: latestError } = await context.service
      .from("meta_ads_import_jobs")
      .select("batch_id")
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) return NextResponse.json({ error: latestError.message }, { status: 500 });
    if (!latest) {
      const emptyCounts: Record<JobStatus, number> = { pending: 0, processing: 0, done: 0, failed: 0, canceled: 0 };
      const emptyAggregate = { accounts: 0, campaigns: 0, adSets: 0, ads: 0, insights: 0 };
      return NextResponse.json({ batchId: null, total: 0, counts: emptyCounts, done: true, aggregate: emptyAggregate, errors: [] });
    }
    batchId = latest.batch_id;
  }

  const { data: jobs, error } = await context.service
    .from("meta_ads_import_jobs")
    .select("status, result_accounts, result_campaigns, result_ad_sets, result_ads, result_insights, error_message")
    .eq("organization_id", context.organizationId)
    .eq("batch_id", batchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<JobStatus, number> = { pending: 0, processing: 0, done: 0, failed: 0, canceled: 0 };
  const aggregate = { accounts: 0, campaigns: 0, adSets: 0, ads: 0, insights: 0 };
  const errors: string[] = [];

  for (const job of jobs ?? []) {
    const status = job.status as JobStatus;
    counts[status] = (counts[status] ?? 0) + 1;
    if (status === "done") {
      // Cada chunk resincroniza os mesmos metadados (contas/campanhas/conjuntos/
      // anuncios) — nao e aditivo entre chunks, so insights (por data) somam.
      aggregate.accounts = Math.max(aggregate.accounts, job.result_accounts ?? 0);
      aggregate.campaigns = Math.max(aggregate.campaigns, job.result_campaigns ?? 0);
      aggregate.adSets = Math.max(aggregate.adSets, job.result_ad_sets ?? 0);
      aggregate.ads = Math.max(aggregate.ads, job.result_ads ?? 0);
      aggregate.insights += job.result_insights ?? 0;
    }
    if (status === "failed" && job.error_message) errors.push(job.error_message);
  }

  const total = jobs?.length ?? 0;
  const terminal = counts.done + counts.failed + counts.canceled;
  return NextResponse.json({ batchId, total, counts, done: total > 0 && terminal >= total, aggregate, errors });
}
