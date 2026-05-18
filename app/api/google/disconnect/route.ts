import { NextResponse } from "next/server";
import { googleRequestContext, requireGoogleManager } from "@/lib/google-server";

export async function POST(request: Request) {
  try {
    const context = await googleRequestContext(request);
    requireGoogleManager(context);
    const { error } = await context.service
      .from("google_connections")
      .delete()
      .eq("organization_id", context.organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao desconectar Google." }, { status: 401 });
  }
}
