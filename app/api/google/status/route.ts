import { NextResponse } from "next/server";
import { googleRequestContext, type GoogleService } from "@/lib/google-server";

function toStatus(connection: any) {
  return {
    connected: Boolean(connection?.refresh_token),
    googleEmail: connection?.google_email ?? "",
    scopes: connection?.scopes ?? [],
    connectedAt: connection?.connected_at ?? "",
    updatedAt: connection?.updated_at ?? ""
  };
}

export async function GET(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const { data, error } = await context.service
      .from("google_connections")
      .select("*")
      .eq("organization_id", context.organizationId)
      .in("service", ["drive", "youtube", "sheets", "analytics"]);
    if (error) throw error;
    const byService = new Map((data ?? []).map((item: any) => [item.service as GoogleService, item]));
    return NextResponse.json({
      drive: toStatus(byService.get("drive")),
      youtube: toStatus(byService.get("youtube")),
      sheets: toStatus(byService.get("sheets")),
      analytics: toStatus(byService.get("analytics")),
      canManage: context.role === "admin" || context.role === "gestor"
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao consultar conexao Google." }, { status: 401 });
  }
}
