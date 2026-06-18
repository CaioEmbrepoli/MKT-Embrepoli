import { NextResponse } from "next/server";
import { resolveIntegrationHealth, toApiErrorPayload } from "@/lib/api-errors";
import { getMetaConnection, metaRequestContext } from "@/lib/meta-server";

export async function GET(request: Request) {
  try {
    const context = await metaRequestContext(request);
    const connection = await getMetaConnection(context.service, context.organizationId, "ads");
    if (connection?.access_token) {
      await resolveIntegrationHealth(context.service, context.organizationId, "meta_ads", "meta_ads");
    }
    return NextResponse.json({
      connected: Boolean(connection?.access_token),
      service: "ads",
      username: connection?.username ?? "",
      displayName: connection?.display_name ?? "",
      adAccountId: connection?.ad_account_id ?? "",
      adAccountName: connection?.ad_account_name ?? "",
      businessId: connection?.business_id ?? "",
      scopes: connection?.scopes ?? [],
      connectedAt: connection?.connected_at ?? "",
      updatedAt: connection?.updated_at ?? "",
      expiresAt: connection?.expires_at ?? "",
      canManage: context.role === "admin" || context.role === "gestor"
    });
  } catch (error) {
    return NextResponse.json(toApiErrorPayload(error, { provider: "meta_ads", service: "meta_ads" }), { status: 400 });
  }
}
