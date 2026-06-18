import { NextResponse } from "next/server";
import { resolveIntegrationHealth, toApiErrorPayload } from "@/lib/api-errors";
import { getMetaConnection, metaRequestContext } from "@/lib/meta-server";

export async function GET(request: Request) {
  try {
    const context = await metaRequestContext(request);
    const connection = await getMetaConnection(context.service, context.organizationId, "instagram");
    if (connection?.access_token) {
      await resolveIntegrationHealth(context.service, context.organizationId, "instagram", "instagram");
    }
    return NextResponse.json({
      connected: Boolean(connection?.access_token),
      service: "instagram",
      username: connection?.username ?? "",
      displayName: connection?.display_name ?? "",
      avatarUrl: connection?.avatar_url ?? "",
      instagramAccountId: connection?.instagram_account_id ?? "",
      pageId: connection?.page_id ?? "",
      scopes: connection?.scopes ?? [],
      connectedAt: connection?.connected_at ?? "",
      updatedAt: connection?.updated_at ?? "",
      expiresAt: connection?.expires_at ?? "",
      canManage: context.role === "admin" || context.role === "gestor"
    });
  } catch (error) {
    return NextResponse.json(toApiErrorPayload(error, { provider: "instagram", service: "instagram" }), { status: 401 });
  }
}
