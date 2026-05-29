import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  fetchInstagramAccount,
  INSTAGRAM_SCOPES,
  instagramAppId,
  instagramAppSecret,
  instagramOAuthRedirectUri,
  verifyMetaState
} from "@/lib/meta-server";

type InstagramOAuthState = {
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
    const payload = verifyMetaState<InstagramOAuthState>(state);
    if (Date.now() - Number(payload.createdAt) > 15 * 60 * 1000) {
      throw new Error("Estado OAuth expirado. Tente novamente.");
    }

    const appId = instagramAppId();
    const appSecret = instagramAppSecret();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!appId || !appSecret || !supabaseUrl || !serviceKey) {
      throw new Error("Variaveis de ambiente Instagram/Supabase incompletas.");
    }

    const redirectUri = instagramOAuthRedirectUri(request);

    // 1. Trocar code por short-lived token (1 hora) — endpoint do Instagram
    const shortTokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code"
      })
    });
    const shortTokenData = await shortTokenRes.json() as {
      access_token?: string;
      user_id?: number;
      error_type?: string;
      error_message?: string;
    };
    if (!shortTokenRes.ok || !shortTokenData.access_token) {
      throw new Error(shortTokenData.error_message ?? "Falha ao obter token do Instagram.");
    }
    const shortToken = shortTokenData.access_token;

    // 2. Trocar short-lived por Long-Lived Token (60 dias) — graph.instagram.com
    const longTokenUrl = new URL("https://graph.instagram.com/access_token");
    longTokenUrl.searchParams.set("grant_type", "ig_exchange_token");
    longTokenUrl.searchParams.set("client_id", appId);
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("access_token", shortToken);

    const longTokenRes = await fetch(longTokenUrl);
    const longTokenData = await longTokenRes.json() as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: { message?: string };
    };
    if (!longTokenRes.ok || !longTokenData.access_token) {
      throw new Error(longTokenData.error?.message ?? "Falha ao obter Long-Lived Token do Instagram.");
    }
    const accessToken = longTokenData.access_token; // IGAA...
    const expiresIn = longTokenData.expires_in ?? 60 * 24 * 60 * 60; // fallback 60 dias
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3. Buscar dados da conta Instagram (já suporta tokens IGAA via graph.instagram.com)
    const account = await fetchInstagramAccount(accessToken);
    if (!account.instagramAccountId) {
      throw new Error("Nao foi possivel identificar a conta Instagram vinculada.");
    }

    // 4. Salvar conexao no banco
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
