import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Avisa os admins quando o token OAuth do Google (Drive/YouTube) estiver perto de expirar.
//
// Diferente do Instagram, o Google nao oferece um endpoint que "estenda" a validade do
// refresh_token: enquanto o app estiver em modo "Teste" no Google Cloud Console, o
// refresh_token e revogado automaticamente ~7 dias apos a concessao (connected_at),
// sem possibilidade de renovacao automatica via API — so reconectando manualmente
// (ou publicando/verificando o app, o que remove esse limite).
//
// Estrategia: roda 1x por dia; gera notificacao (1 por ciclo de conexao, deduplicada por
// connection.id + connected_at) para os admins ativos da organizacao quando a estimativa
// de expiracao (connected_at + 7 dias) estiver a <= ALERT_WINDOW_DAYS de distancia.
// O id deterministico evita reenvio diario enquanto o ciclo nao mudar (reconectar gera
// um novo connected_at -> novo ciclo -> nova notificacao quando voltar a se aproximar).

const ALERT_WINDOW_DAYS = 2;
const TOKEN_LIFETIME_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const SERVICE_LABEL: Record<string, string> = {
  drive: "Google Drive",
  youtube: "YouTube"
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase service role nao configurado." }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: connections, error } = await adminClient
    .from("google_connections")
    .select("id, organization_id, service, connected_at, refresh_token")
    .neq("refresh_token", "");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!connections?.length) return NextResponse.json({ ok: true, results: [], message: "Nenhuma conexao Google ativa encontrada." });

  const now = Date.now();
  const results: Array<{ id: string; organizationId: string; service: string; status: string; daysLeft?: number; notified?: number }> = [];

  for (const conn of connections) {
    const connectedAt = conn.connected_at ? new Date(conn.connected_at).getTime() : null;
    if (!connectedAt || Number.isNaN(connectedAt)) {
      results.push({ id: conn.id, organizationId: conn.organization_id, service: conn.service, status: "skipped_no_connected_at" });
      continue;
    }

    const estimatedExpiry = connectedAt + TOKEN_LIFETIME_DAYS * DAY_MS;
    const daysLeft = Math.floor((estimatedExpiry - now) / DAY_MS);

    if (daysLeft > ALERT_WINDOW_DAYS) {
      results.push({ id: conn.id, organizationId: conn.organization_id, service: conn.service, status: "ok", daysLeft });
      continue;
    }

    const { data: admins, error: adminsError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("organization_id", conn.organization_id)
      .eq("role", "admin")
      .eq("active", true);
    if (adminsError) {
      results.push({ id: conn.id, organizationId: conn.organization_id, service: conn.service, status: "error_admins", daysLeft });
      continue;
    }
    if (!admins?.length) {
      results.push({ id: conn.id, organizationId: conn.organization_id, service: conn.service, status: "no_admins", daysLeft });
      continue;
    }

    const serviceLabel = SERVICE_LABEL[conn.service] ?? conn.service;
    const cycleKey = String(connectedAt);
    const title = daysLeft <= 0
      ? `Token do ${serviceLabel} deve ter expirado`
      : `Token do ${serviceLabel} expira em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`;
    const description = daysLeft <= 0
      ? `O app Google esta em modo de teste (limite de ${TOKEN_LIFETIME_DAYS} dias, sem renovacao automatica) — reconecte o ${serviceLabel} em Configuracoes > Conta e Permissoes para nao interromper a integracao.`
      : `Estimativa baseada no limite de ${TOKEN_LIFETIME_DAYS} dias do app Google em modo de teste (nao renova sozinho como o Instagram). Reconecte o ${serviceLabel} em Configuracoes > Conta e Permissoes com antecedencia.`;

    const notificationRows = admins.map((admin) => ({
      id: `notification:google-token-expiry:${conn.id}:${cycleKey}:${admin.id}`,
      organization_id: conn.organization_id,
      user_id: admin.id,
      title,
      description,
      target_kind: "system",
      target_id: conn.id,
      read: false,
      created_at: new Date(now).toISOString()
    }));

    const { error: insertError } = await adminClient
      .from("notifications")
      .upsert(notificationRows, { onConflict: "id", ignoreDuplicates: true });
    if (insertError) {
      results.push({ id: conn.id, organizationId: conn.organization_id, service: conn.service, status: "error_notify", daysLeft });
      continue;
    }

    results.push({ id: conn.id, organizationId: conn.organization_id, service: conn.service, status: "notified", daysLeft, notified: notificationRows.length });
  }

  return NextResponse.json({ ok: true, results });
}
