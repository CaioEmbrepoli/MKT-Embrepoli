import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GOOGLE_SCOPES_BY_SERVICE, type GoogleService, googleRedirectUri, normalizeGoogleService, verifyGoogleState } from "@/lib/google-server";

type GoogleState = {
  userId: string;
  organizationId: string;
  googleService?: GoogleService;
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
  if (oauthError) return siteRedirect(request, { google: "error", message: oauthError });
  if (!code || !state) return siteRedirect(request, { google: "error", message: "missing_code" });

  try {
    const payload = verifyGoogleState<GoogleState>(state);
    if (Date.now() - Number(payload.createdAt) > 15 * 60 * 1000) {
      throw new Error("Estado OAuth expirado.");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) {
      throw new Error("Variaveis de ambiente Google/Supabase incompletas.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(request),
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Falha ao obter token Google.");
    }
    if (!tokenData.refresh_token) {
      throw new Error("Google nao retornou refresh token. Remova a permissao do app na Conta Google e conecte novamente.");
    }

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userInfo = await userInfoResponse.json();
    const googleEmail = String(userInfo.email || "Conta Google conectada");
    const googleService = normalizeGoogleService(payload.googleService);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const expiresAt = new Date(Date.now() + Number(tokenData.expires_in ?? 3600) * 1000).toISOString();
    const { error } = await service.from("google_connections").upsert({
      organization_id: payload.organizationId,
      service: googleService,
      google_email: googleEmail,
      scopes: GOOGLE_SCOPES_BY_SERVICE[googleService],
      access_token: String(tokenData.access_token),
      refresh_token: String(tokenData.refresh_token),
      expires_at: expiresAt,
      connected_by: payload.userId,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "organization_id,service" });
    if (error) throw error;

    return siteRedirect(request, { google: "connected", service: googleService });
  } catch (error) {
    return siteRedirect(request, { google: "error", message: error instanceof Error ? error.message : "oauth_failed" });
  }
}
