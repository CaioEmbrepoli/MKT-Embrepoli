import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { recordIntegrationFailure, toApiErrorPayload } from "@/lib/api-errors";
import { monthlyChunks, META_ADS_MAX_HISTORY_MONTHS } from "@/lib/meta-ads-server";
import { metaRequestContext, requireMetaManager, type MetaRequestContext } from "@/lib/meta-server";

export const dynamic = "force-dynamic";

type RangeType = "last_30d" | "last_12m" | "all_time";

function chunksForRangeType(rangeType: RangeType) {
  if (rangeType === "last_30d") {
    const until = new Date();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return [{ since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) }];
  }
  if (rangeType === "last_12m") return monthlyChunks(12);
  return monthlyChunks(META_ADS_MAX_HISTORY_MONTHS);
}

export async function POST(request: Request) {
  let context: MetaRequestContext | null = null;
  try {
    context = await metaRequestContext(request);
    requireMetaManager(context);
    const body = await request.json().catch(() => ({}));
    const rangeType: RangeType = ["last_30d", "last_12m", "all_time"].includes(body?.rangeType) ? body.rangeType : "last_30d";

    // Cancela lotes anteriores do mesmo tipo ainda pendentes (deixa o que ja
    // estiver em "processing" terminar) antes de criar o lote novo.
    await context.service
      .from("meta_ads_import_jobs")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("organization_id", context.organizationId)
      .eq("range_type", rangeType)
      .eq("status", "pending");

    const chunks = chunksForRangeType(rangeType);
    const batchId = crypto.randomUUID();
    const now = new Date().toISOString();
    const rows = chunks.map((chunk, index) => ({
      id: crypto.randomUUID(),
      organization_id: context!.organizationId,
      batch_id: batchId,
      range_type: rangeType,
      chunk_index: index,
      chunk_total: chunks.length,
      since_date: chunk.since,
      until_date: chunk.until,
      status: "pending",
      created_by: context!.userId,
      created_at: now,
      updated_at: now
    }));

    const { error } = await context.service.from("meta_ads_import_jobs").insert(rows);
    if (error) throw new Error(`meta_ads_import_jobs insert: ${error.message}`);

    return NextResponse.json({ batchId, totalJobs: rows.length });
  } catch (error) {
    console.error("[meta/ads/import/enqueue]", error);
    const payload = toApiErrorPayload(error, { provider: "meta_ads", service: "meta_ads" });
    if (context) await recordIntegrationFailure(context.service, context.organizationId, payload, context.userId);
    return NextResponse.json(payload, { status: 400 });
  }
}
