import { NextResponse } from "next/server";
import { fetchInstagramAccount, INSTAGRAM_SCOPES, metaRequestContext, requireMetaManager } from "@/lib/meta-server";

export async function POST(request: Request) {
  try {
    const context = await metaRequestContext(request);
    requireMetaManager(context);

    const body = await request.json().catch(() => ({}));
    const accessToken = String(body.accessToken || "").trim();
    const expiresAt = String(body.expiresAt || "").trim() || null;
    if (!accessToken) throw new Error("Cole o token gerado no Meta Developer.");

    const account = await fetchInstagramAccount(accessToken);
    if (!account.instagramAccountId) {
      throw new Error("Nao foi possivel identificar a conta Instagram vinculada a esse token.");
    }

    const now = new Date().toISOString();
    const { error } = await context.service.from("meta_connections").upsert({
      organization_id: context.organizationId,
      service: "instagram",
      instagram_account_id: account.instagramAccountId,
      page_id: account.pageId || null,
      username: account.username,
      display_name: account.displayName,
      avatar_url: account.avatarUrl,
      scopes: INSTAGRAM_SCOPES,
      access_token: accessToken,
      expires_at: expiresAt,
      connected_by: context.userId,
      connected_at: now,
      updated_at: now
    }, { onConflict: "organization_id,service" });
    if (error) throw error;

    return NextResponse.json({
      connected: true,
      service: "instagram",
      username: account.username,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      instagramAccountId: account.instagramAccountId,
      pageId: account.pageId,
      scopes: INSTAGRAM_SCOPES,
      connectedAt: now,
      updatedAt: now,
      expiresAt: expiresAt ?? "",
      canManage: true
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao conectar Instagram/Meta." },
      { status: 400 }
    );
  }
}
