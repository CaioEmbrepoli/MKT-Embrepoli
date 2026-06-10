import { NextResponse } from "next/server";
import { importMetaAdsData } from "@/lib/meta-ads-server";
import { metaRequestContext, requireMetaManager } from "@/lib/meta-server";

export async function POST(request: Request) {
  try {
    const context = await metaRequestContext(request);
    requireMetaManager(context);
    const summary = await importMetaAdsData(context);
    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao importar Meta Ads.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
