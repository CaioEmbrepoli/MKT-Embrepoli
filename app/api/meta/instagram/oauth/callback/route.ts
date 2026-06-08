import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  fetchInstagramAccount,
  INSTAGRAM_BUSINESS_SCOPES,
  INSTAGRAM_OAUTH_TOKEN_URL,
  instagramAppId,
  instagramAppSecret,
  instagramGraphAccessTokenUrl,
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

    // 1. Trocar "code" por um Access Token de curta duração (Instagram User Access Token, ~1h)
    //    Endpoint nativo do Instagram Business Login — NÃO é graph.facebook.com.
    //    Doc: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
    const shortTokenForm = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code
    });
    const shortTokenRes = await fetch(INSTAGRAM_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: shortTokenForm
    });
    const shortTokenData = await shortTokenRes.json().catch(() => ({})) as {
      access_token?: string;
      user_id?: string | number;
      permissions?: string[];
      error_message?: string;
      error_type?: string;
      error?: { message?: string };
    };
    if (!shortTokenRes.ok || !shortTokenData.access_token) {
      throw new Error(
        shortTokenData.error_message || shortTokenData.error?.message || "Falha ao obter token do Instagram."
      );
    }
    const shortToken = shortTokenData.access_token;

    // 2. Trocar o token de curta duração por um Long-Lived Token (60 dias)
    //    GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=...&access_token=...
    const longTokenUrl = new URL(instagramGraphAccessTokenUrl());
    longTokenUrl.searchParams.set("grant_type", "ig_exchange_token");
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("access_token", shortToken);

    const longTokenRes = await fetch(longTokenUrl);
    const longTokenData = await longTokenRes.json().catch(() => ({})) as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: { message?: string };
    };
    if (!longTokenRes.ok || !longTokenData.access_token) {
      throw new Error(longTokenData.error?.message ?? "Falha ao obter Long-Lived Token do Instagram.");
    }
    const accessToken = longTokenData.access_token;
    const expiresIn = longTokenData.expires_in ?? 60 * 24 * 60 * 60; // padrão: 60 dias
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3. Buscar dados da conta Instagram (fetchInstagramAccount já reconhece tokens IGAA/IGQV/IGQ
    //    e consulta graph.instagram.com/me corretamente)
    const account = await fetchInstagramAccount(accessToken);
    if (!account.instagramAccountId) {
      throw new Error("Nao foi possivel identificar a conta do Instagram conectada. Tente novamente.");
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
      scopes: shortTokenData.permissions?.length ? shortTokenData.permissions : INSTAGRAM_BUSINESS_SCOPES,
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
