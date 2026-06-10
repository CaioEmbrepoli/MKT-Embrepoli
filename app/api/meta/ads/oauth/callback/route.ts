import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  META_ADS_SCOPES,
  graphGet,
  metaAdsOAuthRedirectUri,
  metaAppId,
  metaAppSecret,
  metaOAuthAccessTokenUrl,
  verifyMetaState
} from "@/lib/meta-server";

type MetaAdsOAuthState = {
  userId: string;
  organizationId: string;
  service: "ads";
  createdAt: number;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: { message?: string };
};

type MeResponse = {
  id?: string;
  name?: string;
  business_users?: { data?: Array<{ business?: { id?: string; name?: string } }> };
};

type AccountsResponse = {
  data?: Array<{ id?: string; account_id?: string; name?: string }>;
};

function siteRedirect(request: Request, params: Record<string, string>) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const url = new URL(site);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

async function fetchJson<T>(url: URL) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Falha no OAuth Meta Ads.");
  }
  return data as T;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) return siteRedirect(request, { meta_ads: "error", message: oauthError });
  if (!code || !state) return siteRedirect(request, { meta_ads: "error", message: "missing_code" });

  try {
    const payload = verifyMetaState<MetaAdsOAuthState>(state);
    if (payload.service !== "ads") throw new Error("Estado OAuth invalido para Meta Ads.");
    if (Date.now() - Number(payload.createdAt) > 15 * 60 * 1000) {
      throw new Error("Estado OAuth expirado. Tente novamente.");
    }

    const appId = metaAppId();
    const appSecret = metaAppSecret();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!appId || !appSecret || !supabaseUrl || !serviceKey) {
      throw new Error("Variaveis de ambiente Meta Ads/Supabase incompletas.");
    }

    const shortUrl = new URL(metaOAuthAccessTokenUrl());
    shortUrl.searchParams.set("client_id", appId);
    shortUrl.searchParams.set("client_secret", appSecret);
    shortUrl.searchParams.set("redirect_uri", metaAdsOAuthRedirectUri(request));
    shortUrl.searchParams.set("code", code);
    const shortToken = await fetchJson<TokenResponse>(shortUrl);
    if (!shortToken.access_token) throw new Error("Meta Ads nao retornou access token.");

    const longUrl = new URL(metaOAuthAccessTokenUrl());
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);
    const longToken = await fetchJson<TokenResponse>(longUrl);
    const accessToken = longToken.access_token || shortToken.access_token;
    const expiresIn = longToken.expires_in || shortToken.expires_in || 60 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const me = await graphGet<MeResponse>("/me", accessToken, {
      fields: "id,name,business_users{business{id,name}}"
    });
    const accounts = await graphGet<AccountsResponse>("/me/adaccounts", accessToken, {
      fields: "id,account_id,name",
      limit: "25"
    });
    const firstAccount = accounts.data?.find((account) => account.id || account.account_id);
    const business = me.business_users?.data?.find((item) => item.business?.id)?.business;
    const now = new Date().toISOString();

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { error: dbError } = await service.from("meta_connections").upsert({
      organization_id: payload.organizationId,
      service: "ads",
      instagram_account_id: null,
      page_id: null,
      ad_account_id: firstAccount?.id || firstAccount?.account_id || null,
      ad_account_name: firstAccount?.name || "",
      business_id: business?.id || "",
      username: me.name || "Meta Ads",
      display_name: me.name || "Meta Ads",
      avatar_url: "",
      scopes: META_ADS_SCOPES,
      access_token: accessToken,
      expires_at: expiresAt,
      connected_by: payload.userId,
      connected_at: now,
      updated_at: now
    }, { onConflict: "organization_id,service" });
    if (dbError) throw dbError;

    return siteRedirect(request, { meta_ads: "connected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return siteRedirect(request, { meta_ads: "error", message });
  }
}
