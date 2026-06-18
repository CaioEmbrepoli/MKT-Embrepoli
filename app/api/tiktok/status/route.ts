import { NextResponse } from "next/server";
import { resolveIntegrationHealth, toApiErrorPayload } from "@/lib/api-errors";
import { getTikTokConnection, tiktokEnvironment, tiktokRequestContext } from "@/lib/tiktok-server";

export async function GET(request: Request) {
  try {
    const context = await tiktokRequestContext(request);
    const environment = tiktokEnvironment();
    const connection = await getTikTokConnection(context.service, context.organizationId, environment);
    if (connection?.refresh_token) {
      await resolveIntegrationHealth(context.service, context.organizationId, "tiktok", "tiktok");
    }
    return NextResponse.json({
      connected: Boolean(connection?.refresh_token),
      environment,
      displayName: connection?.display_name ?? "",
      avatarUrl: connection?.avatar_url ?? "",
      openId: connection?.tiktok_open_id ?? "",
      scopes: connection?.scopes ?? [],
      connectedAt: connection?.connected_at ?? "",
      updatedAt: connection?.updated_at ?? "",
      canManage: context.role === "admin" || context.role === "gestor"
    });
  } catch (error) {
    return NextResponse.json(toApiErrorPayload(error, { provider: "tiktok", service: "tiktok" }), { status: 401 });
  }
}
