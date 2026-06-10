import { NextResponse } from "next/server";
import { metaRequestContext, requireMetaManager } from "@/lib/meta-server";

export async function POST(request: Request) {
  try {
    const context = await metaRequestContext(request);
    requireMetaManager(context);
    const { error } = await context.service
      .from("meta_connections")
      .delete()
      .eq("organization_id", context.organizationId)
      .eq("service", "ads");
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao desconectar Meta Ads.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
