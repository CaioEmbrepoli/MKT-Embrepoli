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
      .eq("service", "instagram");
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao desconectar Instagram/Meta." },
      { status: 400 }
    );
  }
}
