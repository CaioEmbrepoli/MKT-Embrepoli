import { NextResponse } from "next/server";
import { recordIntegrationFailure, toApiErrorPayload } from "@/lib/api-errors";
import { importMetaAdsData } from "@/lib/meta-ads-server";
import { metaRequestContext, requireMetaManager, type MetaRequestContext } from "@/lib/meta-server";

// "all" busca insights em lotes mensais por conta, podendo passar de 1 minuto
// — sem isso o Vercel corta a funcao no limite padrao (10s/60s).
export const maxDuration = 300;

export async function POST(request: Request) {
  let context: MetaRequestContext | null = null;
  try {
    context = await metaRequestContext(request);
    requireMetaManager(context);
    const body = await request.json().catch(() => ({}));
    const range = body?.range === "all" ? "all" : "last_30d";
    const summary = await importMetaAdsData(context, range);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[meta/ads/import]", error);
    const payload = toApiErrorPayload(error, { provider: "meta_ads", service: "meta_ads" });
    if (context) await recordIntegrationFailure(context.service, context.organizationId, payload, context.userId);
    return NextResponse.json(payload, { status: 400 });
  }
}
