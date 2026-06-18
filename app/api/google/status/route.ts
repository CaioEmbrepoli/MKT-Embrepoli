import { NextResponse } from "next/server";
import { resolveIntegrationHealth, toApiErrorPayload } from "@/lib/api-errors";
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
    for (const service of ["drive", "youtube", "sheets", "analytics"] as GoogleService[]) {
      if (byService.get(service)?.refresh_token) {
        await resolveIntegrationHealth(context.service, context.organizationId, service === "youtube" ? "youtube" : "google", service);
      }
    }
    return NextResponse.json({
      drive: toStatus(byService.get("drive")),
      youtube: toStatus(byService.get("youtube")),
      sheets: toStatus(byService.get("sheets")),
      analytics: toStatus(byService.get("analytics")),
      canManage: context.role === "admin" || context.role === "gestor"
    });
  } catch (error) {
    return NextResponse.json(toApiErrorPayload(error, { provider: "google", service: "drive" }), { status: 401 });
  }
}
