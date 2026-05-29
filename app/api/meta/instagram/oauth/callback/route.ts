import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  fetchInstagramAccount,
  INSTAGRAM_SCOPES,
  metaAppId,
  metaAppSecret,
  metaGraphVersion,
  metaOAuthRedirectUri,
  verifyMetaState
} from "@/lib/meta-server";

type MetaState = {
  userId: string;
  organizationId: string;
  createdAt: number;
};

function siteRedirect(request: Request, params: Record<string, string>) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const url = new URL(site);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) return siteRedirect(request, { instagram: "error", message: oauthError });
  if (!code || !state) return siteRedirect(request, { instagram: "error", message: "missing_code" });

  try {
    const payload = verifyMetaState<MetaState>(state);
    if (Date.now() - Number(payload.createdAt) > 15 * 60 * 1000) {
      throw new Error("Estado OAuth expirado. Tente novamente.");
    }

    const appId = metaAppId();
    const appSecret = metaAppSecret();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!appId || !appSecret || !supabaseUrl || !serviceKey) {
      throw new Error("Variaveis de ambiente Meta/Supabase incompletas.");
    }

    const redirectUri = metaOAuthRedirectUri(request);
    const graphBase = `https://graph.facebook.com/${metaGraphVersion()}`;

    // 1. Trocar code por short-lived token (1 hora)
    const shortTokenRes = await fetch(`${graphBase}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: appId, client_secret: appSecret, redirect_uri: redirectUri })
    });
    const shortTokenData = await shortTokenRes.json() as { access_token?: string; error?: { message?: string } };
    if (!shortTokenRes.ok || !shortTokenData.access_token) {
      throw new Error(shortTokenData.error?.message ?? "Falha ao obter token do Facebook.");
    }
    const shortToken = shortTokenData.access_token;

    // 2. Trocar short-lived por Long-Lived Token (60 dias)
    const longTokenUrl = new URL(`${graphBase}/oauth/access_token`);
    longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longTokenUrl.searchParams.set("client_id", appId);
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("fb_exchange_token", shortToken);

    const longTokenRes = await fetch(longTokenUrl);
    const longTokenData = await longTokenRes.json() as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (!longTokenRes.ok || !longTokenData.access_token) {
      throw new Error(longTokenData.error?.message ?? "Falha ao obter Long-Lived Token do Facebook.");
    }
    const accessToken = longTokenData.access_token;
    const expiresIn = longTokenData.expires_in ?? 60 * 24 * 60 * 60; // fallback 60 dias
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3. Buscar conta Instagram vinculada
    const account = await fetchInstagramAccount(accessToken);
    if (!account.instagramAccountId) {
      throw new Error("Nenhuma conta Instagram Business vinculada a essa conta do Facebook.");
    }

    // 4. Salvar conexão no banco
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const now = new Date().toISOString();
    const { error: dbError } = await service.from("meta_connections").upsert({
      organization_id: payload.organizationId,
      service: "instagram",
      instagram_account_id: account.instagramAccountId,
      page_id: account.pageId || null,
      username: account.username,
      display_name: account.displayName,
      avatar_url: account.avatarUrl,
      scopes: INSTAGRAM_SCOPES,
      access_token: accessToken,
      expires_at: expiresAt,
      connected_by: payload.userId,
      connected_at: now,
      updated_at: now
    }, { onConflict: "organization_id,service" });
    if (dbError) throw dbError;

    return siteRedirect(request, { instagram: "connected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return siteRedirect(request, { instagram: "error", message });
  }
}
