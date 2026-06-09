import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type GoogleService = "drive" | "youtube" | "sheets";

export const GOOGLE_SCOPES_BY_SERVICE: Record<GoogleService, string[]> = {
  drive: ["https://www.googleapis.com/auth/drive.readonly"],
  youtube: [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
    "https://www.googleapis.com/auth/yt-analytics.readonly"
  ],
  sheets: ["https://www.googleapis.com/auth/spreadsheets"]
};

export function normalizeGoogleService(value: string | null | undefined): GoogleService {
  if (value === "youtube") return "youtube";
  if (value === "sheets") return "sheets";
  return "drive";
}

export const GOOGLE_SERVICE_LABELS: Record<GoogleService, string> = {
  drive: "Google Drive",
  youtube: "YouTube",
  sheets: "Google Planilhas"
};

type GoogleConnectionRow = {
  id: string;
  organization_id: string;
  service: GoogleService;
  google_email: string;
  scopes: string[];
  access_token: string;
  refresh_token: string;
  expires_at: string;
  connected_by: string | null;
  connected_at: string;
  updated_at: string;
};

export type GoogleRequestContext = {
  userId: string;
  organizationId: string;
  role: "admin" | "gestor" | "colaborador";
  active: boolean;
  service: SupabaseClient;
};

export function googleRedirectUri(request: Request) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${new URL(request.url).origin}/api/google/oauth/callback`;
}

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error("Supabase nao configurado para Google OAuth.");
  return { url, anonKey, serviceKey };
}

export async function googleRequestContext(request: Request): Promise<GoogleRequestContext> {
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

export function requireGoogleManager(context: GoogleRequestContext) {
  if (context.role !== "admin" && context.role !== "gestor") {
    throw new Error("Apenas Administrador ou Gestor pode gerenciar a conexao Google.");
  }
}

function stateSecret() {
  return process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "embrepoli-google-oauth";
}

export function signGoogleState(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyGoogleState<T extends Record<string, unknown>>(state: string): T {
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

export async function exchangeRefreshToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET nao configurados.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    const code = data?.error ?? "?";
    const desc = String(data?.error_description ?? "no_description").slice(0, 120);
    console.error(`GOOGLE_ERR code=${code} status=${response.status} desc="${desc}"`);
    throw new Error(data.error_description || data.error || "Nao foi possivel renovar a conexao Google.");
  }
  return {
    accessToken: String(data.access_token),
    expiresAt: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000).toISOString()
  };
}

export async function getGoogleConnection(supabaseClient: SupabaseClient, organizationId: string, googleService: GoogleService) {
  const { data, error } = await supabaseClient
    .from("google_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("service", googleService)
    .maybeSingle();
  if (error) throw error;
  return data as GoogleConnectionRow | null;
}

export async function getGoogleAccessToken(context: GoogleRequestContext, googleService: GoogleService) {
  const connection = await getGoogleConnection(context.service, context.organizationId, googleService);
  const serviceLabel = GOOGLE_SERVICE_LABELS[googleService];
  if (!connection?.refresh_token) throw new Error(`${serviceLabel} nao conectado. Peca para um Gestor conectar a conta corporativa.`);

  const expiresAt = new Date(connection.expires_at || 0).getTime();
  if (connection.access_token && expiresAt > Date.now() + 60_000) {
    return connection.access_token;
  }

  let refreshed: { accessToken: string; expiresAt: string };
  try {
    refreshed = await exchangeRefreshToken(connection.refresh_token);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "erro desconhecido";
    // A mensagem do Google ("Token has been expired or revoked.") e identica a usada por outras
    // integracoes (ex.: Instagram) — deixamos explicito qual conexao precisa ser refeita para
    // nao confundir com expiracao do token do Instagram/Meta.
    throw new Error(`Conexao do ${serviceLabel} expirada ou revogada (Google: "${reason}"). Reconecte em Configuracoes > Conta e Permissoes > ${serviceLabel}.`);
  }
  const { error } = await context.service
    .from("google_connections")
    .update({
      access_token: refreshed.accessToken,
      expires_at: refreshed.expiresAt,
      updated_at: new Date().toISOString()
    })
    .eq("id", connection.id);
  if (error) throw error;
  return refreshed.accessToken;
}
