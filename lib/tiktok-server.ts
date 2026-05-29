import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type TikTokEnvironment = "sandbox" | "production";

export const TIKTOK_SCOPES_SANDBOX = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
  "video.publish",
];

export const TIKTOK_SCOPES_PRODUCTION = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
  "video.publish",
];

// Atalho que retorna os scopes certos para o ambiente atual
export function getTikTokScopes() {
  return tiktokEnvironment() === "production" ? TIKTOK_SCOPES_PRODUCTION : TIKTOK_SCOPES_SANDBOX;
}

// Mantido para compatibilidade de importações existentes
export const TIKTOK_SCOPES = TIKTOK_SCOPES_SANDBOX;

type TikTokConnectionRow = {
  id: string;
  organization_id: string;
  environment: TikTokEnvironment;
  tiktok_open_id: string;
  display_name: string;
  avatar_url: string;
  scopes: string[];
  access_token: string;
  refresh_token: string;
  expires_at: string;
  refresh_expires_at: string | null;
  connected_by: string | null;
  connected_at: string;
  updated_at: string;
};

export type TikTokRequestContext = {
  userId: string;
  organizationId: string;
  role: "admin" | "gestor" | "colaborador";
  active: boolean;
  service: SupabaseClient;
};

export function tiktokEnvironment(): TikTokEnvironment {
  return process.env.TIKTOK_ENV === "production" ? "production" : "sandbox";
}

function tiktokEnvValue(sandboxKey: string, productionKey: string) {
  return tiktokEnvironment() === "production"
    ? process.env[productionKey]?.trim()
    : process.env[sandboxKey]?.trim() || process.env[productionKey]?.trim();
}

export function tiktokClientKey() {
  return tiktokEnvValue("TIKTOK_SANDBOX_CLIENT_KEY", "TIKTOK_CLIENT_KEY");
}

export function tiktokClientSecret() {
  return tiktokEnvValue("TIKTOK_SANDBOX_CLIENT_SECRET", "TIKTOK_CLIENT_SECRET");
}

export function tiktokRedirectUri(request: Request) {
  const configured = tiktokEnvironment() === "production"
    ? process.env.TIKTOK_REDIRECT_URI?.trim()
    : process.env.TIKTOK_SANDBOX_REDIRECT_URI?.trim() || process.env.TIKTOK_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${new URL(request.url).origin}/api/tiktok/oauth/callback`;
}

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error("Supabase nao configurado para TikTok OAuth.");
  return { url, anonKey, serviceKey };
}

export async function tiktokRequestContext(request: Request): Promise<TikTokRequestContext> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sessao nao informada.");

  const { url, anonKey, serviceKey } = supabaseEnv();
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) throw new Error("Sessao invalida.");

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: profile, error } = await service
    .from("profiles")
    .select("id, organization_id, role, active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (error || !profile) throw new Error("Perfil nao encontrado.");
  if (!profile.active) throw new Error("Usuario inativo.");

  return {
    userId: authData.user.id,
    organizationId: profile.organization_id,
    role: profile.role,
    active: Boolean(profile.active),
    service
  };
}

export function requireTikTokManager(context: TikTokRequestContext) {
  if (context.role !== "admin" && context.role !== "gestor") {
    throw new Error("Apenas Administrador ou Gestor pode gerenciar a conexao TikTok.");
  }
}

function stateSecret() {
  return process.env.TIKTOK_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "embrepoli-tiktok-oauth";
}

export function signTikTokState(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyTikTokState<T extends Record<string, unknown>>(state: string): T {
  const [body, signature] = state.split(".");
  if (!body || !signature) throw new Error("Estado OAuth invalido.");
  const expected = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error("Assinatura OAuth invalida.");
  }
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
}

export async function exchangeTikTokRefreshToken(refreshToken: string) {
  const clientKey = tiktokClientKey();
  const clientSecret = tiktokClientSecret();
  if (!clientKey || !clientSecret) throw new Error("TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET nao configurados.");

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Nao foi possivel renovar a conexao TikTok.");
  }
  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : refreshToken,
    expiresAt: new Date(Date.now() + Number(data.expires_in ?? 86400) * 1000).toISOString(),
    refreshExpiresAt: data.refresh_expires_in
      ? new Date(Date.now() + Number(data.refresh_expires_in) * 1000).toISOString()
      : null
  };
}

export async function getTikTokConnection(supabaseClient: SupabaseClient, organizationId: string, environment = tiktokEnvironment()) {
  const { data, error } = await supabaseClient
    .from("tiktok_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("environment", environment)
    .maybeSingle();
  if (error) throw error;
  return data as TikTokConnectionRow | null;
}

export async function getTikTokAccessToken(context: TikTokRequestContext) {
  const environment = tiktokEnvironment();
  const connection = await getTikTokConnection(context.service, context.organizationId, environment);
  if (!connection?.refresh_token) throw new Error("TikTok Sandbox nao conectado. Peca para um Gestor conectar a conta.");

  const expiresAt = new Date(connection.expires_at || 0).getTime();
  if (connection.access_token && expiresAt > Date.now() + 60_000) {
    return connection.access_token;
  }

  const refreshed = await exchangeTikTokRefreshToken(connection.refresh_token);
  const { error } = await context.service
    .from("tiktok_connections")
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      expires_at: refreshed.expiresAt,
      refresh_expires_at: refreshed.refreshExpiresAt ?? connection.refresh_expires_at,
      updated_at: new Date().toISOString()
    })
    .eq("id", connection.id);
  if (error) throw error;
  return refreshed.accessToken;
}

export async function fetchTikTokUserInfo(accessToken: string) {
  const fields = [
    "open_id",
    "union_id",
    "avatar_url",
    "display_name",
    "bio_description",
    "profile_deep_link",
    "is_verified",
    "follower_count",
    "following_count",
    "likes_count",
    "video_count"
  ].join(",");
  const response = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok || (data?.error?.code && data.error.code !== "ok")) {
    throw new Error(data?.error?.message || data?.error?.code || "Nao foi possivel ler o perfil TikTok.");
  }
  return data?.data?.user ?? {};
}
