import { NextResponse } from "next/server";
import { recordIntegrationFailure, toApiErrorPayload } from "@/lib/api-errors";
import { importMetaAdsData } from "@/lib/meta-ads-server";
import { metaRequestContext, requireMetaManager, type MetaRequestContext } from "@/lib/meta-server";

export async function POST(request: Request) {
  let context: MetaRequestContext | null = null;
  try {
    context = await metaRequestContext(request);
    requireMetaManager(context);
    const summary = await importMetaAdsData(context);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[meta/ads/import]", error);
    const payload = toApiErrorPayload(error, { provider: "meta_ads", service: "meta_ads" });
    if (context) await recordIntegrationFailure(context.service, context.organizationId, payload, context.userId);
    return NextResponse.json(payload, { status: 400 });
  }
}
