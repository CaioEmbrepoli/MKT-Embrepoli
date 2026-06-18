import type { SupabaseClient } from "@supabase/supabase-js";

export type ApiErrorCode =
  | "oauth_reconnect_required"
  | "missing_scope"
  | "provider_rate_limit"
  | "provider_timeout"
  | "provider_api_error"
  | "not_connected"
  | "env_missing"
  | "permission_denied"
  | "database_error"
  | "unknown_error";

export type ApiErrorProvider =
  | "google"
  | "youtube"
  | "instagram"
  | "meta_ads"
  | "tiktok"
  | "supabase"
  | "vercel";

export type ApiErrorAction =
  | "reconnect_oauth"
  | "ask_manager"
  | "retry"
  | "check_config"
  | "none";

export type IntegrationHealthStatus = "ok" | "warning" | "error";

export type ApiErrorPayload = {
  error: string;
  code: ApiErrorCode;
  provider: ApiErrorProvider;
  service: string;
  userMessage: string;
  technicalMessage?: string;
  action: ApiErrorAction;
  reconnectTarget?: string;
};

export type IntegrationHealth = {
  id: string;
  organizationId: string;
  provider: ApiErrorProvider;
  service: string;
  status: IntegrationHealthStatus;
  lastErrorCode?: ApiErrorCode;
  lastErrorMessage?: string;
  lastTechnicalMessage?: string;
  action?: ApiErrorAction;
  reconnectTarget?: string;
  lastFailedAt?: string;
  resolvedAt?: string;
  updatedAt: string;
};

export class IntegrationApiError extends Error {
  payload: ApiErrorPayload;

  constructor(payload: ApiErrorPayload) {
    super(payload.userMessage);
    this.name = "IntegrationApiError";
    this.payload = payload;
  }
}

export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ApiErrorPayload>;
  return typeof item.error === "string" && typeof item.code === "string" && typeof item.provider === "string";
}

export function errorFromResponse(data: unknown, fallback: Partial<ApiErrorPayload> & { error?: string; provider: ApiErrorProvider; service: string }) {
  if (isApiErrorPayload(data)) {
    throw new IntegrationApiError(data);
  }
  const message = typeof data === "object" && data && "error" in data
    ? String((data as { error?: unknown }).error ?? fallback.error ?? "Erro na integração.")
    : fallback.error ?? "Erro na integração.";
  throw new IntegrationApiError(toApiErrorPayload(new Error(message), fallback));
}

export function toApiErrorPayload(error: unknown, defaults: Partial<ApiErrorPayload> & { provider: ApiErrorProvider; service: string }): ApiErrorPayload {
  if (error instanceof IntegrationApiError) return error.payload;
  if (isApiErrorPayload(error)) return error;

  const rawMessage = error instanceof Error
    ? error.message
    : (typeof error === "object" && error !== null && "message" in error)
      ? String((error as { message: unknown }).message)
      : String(error || "Erro desconhecido.");
  const classified = classifyApiError(rawMessage, defaults.provider, defaults.service);
  return {
    error: classified.userMessage,
    code: defaults.code ?? classified.code,
    provider: defaults.provider,
    service: defaults.service,
    userMessage: defaults.userMessage ?? classified.userMessage,
    technicalMessage: sanitizeTechnicalMessage(defaults.technicalMessage ?? rawMessage),
    action: defaults.action ?? classified.action,
    reconnectTarget: defaults.reconnectTarget ?? classified.reconnectTarget
  };
}

export function classifyApiError(message: string, provider: ApiErrorProvider, service: string): Pick<ApiErrorPayload, "code" | "userMessage" | "action" | "reconnectTarget"> {
  const lower = message.toLowerCase();
  const label = serviceLabel(service, provider);

  if (/env|vari[aá]veis?|client_id|client_secret|api_key|service role|configurad/.test(lower)) {
    return {
      code: "env_missing",
      userMessage: `Configuração ausente para ${label}. Verifique as variáveis de ambiente antes de tentar novamente.`,
      action: "check_config",
      reconnectTarget: service
    };
  }

  if (/rate limit|too many requests|limite de requisi|quota|429/.test(lower)) {
    return {
      code: "provider_rate_limit",
      userMessage: `${label} limitou as requisições no momento. Aguarde alguns minutos e tente novamente.`,
      action: "retry",
      reconnectTarget: service
    };
  }

  if (/timeout|tempo limite|aborted|504|gateway timeout/.test(lower)) {
    return {
      code: "provider_timeout",
      userMessage: `${label} demorou demais para responder. Tente novamente ou reduza o escopo da importação.`,
      action: "retry",
      reconnectTarget: service
    };
  }

  if (/not connected|nao conectado|não conectado|sem conex|conecte|cadastre o token/.test(lower)) {
    return {
      code: "not_connected",
      userMessage: `${label} não está conectado. Peça para um gestor/admin conectar em Configurações > Conta e Permissões.`,
      action: "reconnect_oauth",
      reconnectTarget: service
    };
  }

  if (/invalid_grant|expired or revoked|revogad|token.*expir|expirad|oauth|error validating access token|session has expired|invalid token|token inv[aá]lido|refresh token|access token/.test(lower)) {
    return {
      code: "oauth_reconnect_required",
      userMessage: `A conexão do ${label} expirou ou foi revogada. Peça para um gestor/admin reconectar em Configurações > Conta e Permissões.`,
      action: "reconnect_oauth",
      reconnectTarget: service
    };
  }

  if (/scope|permiss|permission|insufficient|forbidden|403|requires|missing/.test(lower)) {
    return {
      code: "missing_scope",
      userMessage: `${label} não tem a permissão necessária. Peça para um gestor/admin reconectar a integração autorizando os escopos solicitados.`,
      action: "reconnect_oauth",
      reconnectTarget: service
    };
  }

  if (/rls|policy|permission denied|permiss[aã]o|401|unauthorized|sess[aã]o/.test(lower)) {
    return {
      code: "permission_denied",
      userMessage: `Sua sessão ou permissão não autorizou esta ação em ${label}. Entre novamente ou peça acesso a um gestor/admin.`,
      action: "ask_manager",
      reconnectTarget: service
    };
  }

  if (/supabase|postgrest|database|banco|relation|column|schema|duplicate key/.test(lower)) {
    return {
      code: "database_error",
      userMessage: `Erro de banco ao processar ${label}. Verifique a migração ou tente novamente após atualizar o sistema.`,
      action: "check_config",
      reconnectTarget: service
    };
  }

  return {
    code: "provider_api_error",
    userMessage: `Não foi possível concluir a ação em ${label}. O erro técnico foi registrado para diagnóstico.`,
    action: "retry",
    reconnectTarget: service
  };
}

export function serviceLabel(service: string, provider?: ApiErrorProvider) {
  const key = service || provider || "integração";
  const labels: Record<string, string> = {
    drive: "Google Drive",
    youtube: "YouTube",
    sheets: "Google Planilhas",
    analytics: "Google Analytics",
    instagram: "Instagram",
    meta_ads: "Meta Ads",
    tiktok: "TikTok"
  };
  return labels[key] ?? key;
}

export function sanitizeTechnicalMessage(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/access_token=([^&\s]+)/gi, "access_token=[redacted]")
    .replace(/refresh_token=([^&\s]+)/gi, "refresh_token=[redacted]")
    .replace(/(["']?(?:access_token|refresh_token|client_secret|api_key|service_role)["']?\s*[:=]\s*)["']?[^"',\s}]+/gi, "$1[redacted]")
    .slice(0, 500);
}

export async function recordIntegrationFailure(
  client: SupabaseClient,
  organizationId: string,
  payload: ApiErrorPayload,
  profileId?: string
) {
  try {
    const now = new Date().toISOString();
    await client.from("integration_health").upsert({
      organization_id: organizationId,
      provider: payload.provider,
      service: payload.service,
      status: "error",
      last_error_code: payload.code,
      last_error_message: payload.userMessage,
      last_technical_message: payload.technicalMessage ?? null,
      action: payload.action,
      reconnect_target: payload.reconnectTarget ?? null,
      last_failed_at: now,
      resolved_at: null,
      updated_at: now
    }, { onConflict: "organization_id,provider,service" });
    await client.from("error_logs").insert({
      organization_id: organizationId,
      provider: payload.provider,
      service: payload.service,
      error_code: payload.code ?? null,
      user_message: payload.userMessage ?? null,
      technical_message: payload.technicalMessage ?? null,
      action: payload.action ?? null,
      profile_id: profileId ?? null,
      created_at: now
    });
  } catch (error) {
    console.warn("[integration-health] failed to record", error);
  }
}

export async function resolveIntegrationHealth(
  client: SupabaseClient,
  organizationId: string,
  provider: ApiErrorProvider,
  service: string
) {
  try {
    await client.from("integration_health").upsert({
      organization_id: organizationId,
      provider,
      service,
      status: "ok",
      last_error_code: null,
      last_error_message: null,
      last_technical_message: null,
      action: "none",
      reconnect_target: service,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "organization_id,provider,service" });
  } catch (error) {
    console.warn("[integration-health] failed to resolve", error);
  }
}
