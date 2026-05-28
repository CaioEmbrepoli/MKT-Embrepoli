import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getTikTokScopes, fetchTikTokUserInfo, tiktokClientKey, tiktokClientSecret, tiktokEnvironment, tiktokRedirectUri, verifyTikTokState, type TikTokEnvironment } from "@/lib/tiktok-server";

type TikTokState = {
  userId: string;
  organizationId: string;
  environment: TikTokEnvironment;
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
  if (oauthError) return siteRedirect(request, { tiktok: "error", message: oauthError });
  if (!code || !state) return siteRedirect(request, { tiktok: "error", message: "missing_code" });

  try {
    const payload = verifyTikTokState<TikTokState>(state);
    if (Date.now() - Number(payload.createdAt) > 15 * 60 * 1000) {
      throw new Error("Estado OAuth expirado.");
    }
    const environment = tiktokEnvironment();
    if (payload.environment !== environment) {
      throw new Error("Ambiente TikTok diferente do configurado.");
    }

    const clientKey = tiktokClientKey();
    const clientSecret = tiktokClientSecret();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!clientKey || !clientSecret || !supabaseUrl || !serviceKey) {
      throw new Error("Variaveis de ambiente TikTok/Supabase incompletas.");
    }

    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_key: clientKey,
        client_secret: clientSecret,
        redirect_uri: tiktokRedirectUri(request),
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Falha ao obter token TikTok.");
    }
    if (!tokenData.refresh_token) {
      throw new Error("TikTok nao retornou refresh token. Reconecte a conta Sandbox.");
    }

    const userInfo = await fetchTikTokUserInfo(String(tokenData.access_token));
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const expiresAt = new Date(Date.now() + Number(tokenData.expires_in ?? 86400) * 1000).toISOString();
    const refreshExpiresAt = tokenData.refresh_expires_in
      ? new Date(Date.now() + Number(tokenData.refresh_expires_in) * 1000).toISOString()
      : null;

    const { error } = await service.from("tiktok_connections").upsert({
      organization_id: payload.organizationId,
      environment,
      tiktok_open_id: String(tokenData.open_id || userInfo.open_id || ""),
      display_name: String(userInfo.display_name || "Conta TikTok conectada"),
      avatar_url: String(userInfo.avatar_url || ""),
      scopes: getTikTokScopes(),
      access_token: String(tokenData.access_token),
      refresh_token: String(tokenData.refresh_token),
      expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
      connected_by: payload.userId,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "organization_id,environment" });
    if (error) throw error;

    return siteRedirect(request, { tiktok: "connected", environment });
  } catch (error) {
    return siteRedirect(request, { tiktok: "error", message: error instanceof Error ? error.message : "oauth_failed" });
  }
}
