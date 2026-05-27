import { NextResponse } from "next/server";
import { requireTikTokManager, tiktokEnvironment, tiktokRequestContext } from "@/lib/tiktok-server";

export async function POST(request: Request) {
  try {
    const context = await tiktokRequestContext(request);
    requireTikTokManager(context);
    const { error } = await context.service
      .from("tiktok_connections")
      .delete()
      .eq("organization_id", context.organizationId)
      .eq("environment", tiktokEnvironment());
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao desconectar TikTok." }, { status: 401 });
  }
}
