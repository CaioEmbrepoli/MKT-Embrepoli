import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { instagramGraphRefreshTokenUrl } from "@/lib/meta-server";

export const dynamic = "force-dynamic";

// Renova automaticamente os Long-Lived Tokens do Instagram Business Login (tokens IGAA.../IGQV.../IGQ...)
// antes que expirem — elimina a necessidade de reconectar manualmente a cada ~60 dias.
//
// Regras da Meta para `grant_type=ig_refresh_token` (graph.instagram.com/refresh_access_token):
//   - o token precisa ter pelo menos 24h desde que foi emitido/renovado
//   - o token ainda precisa estar válido (não pode já ter expirado)
//   - o novo token também dura ~60 dias a partir da renovação
//
// Estratégia: roda 1x por dia; renova qualquer conexão Instagram cujo token vence em
// menos de 10 dias E que tenha pelo menos 24h desde a última atualização.

const REFRESH_WINDOW_DAYS = 10;
const MIN_TOKEN_AGE_HOURS = 24;

function isInstagramNativeToken(accessToken: string | null | undefined) {
  if (!accessToken) return false;
  return accessToken.startsWith("IGAA") || accessToken.startsWith("IGQV") || accessToken.startsWith("IGQ");
}

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
    .from("meta_connections")
    .select("id, organization_id, access_token, expires_at, updated_at")
    .eq("service", "instagram");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!connections?.length) return NextResponse.json({ ok: true, results: [], message: "Nenhuma conexao Instagram encontrada." });

  const now = Date.now();
  const refreshWindowMs = REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const minAgeMs = MIN_TOKEN_AGE_HOURS * 60 * 60 * 1000;

  const results: Array<{ id: string; organizationId: string; status: string; message?: string; expiresAt?: string }> = [];

  for (const conn of connections) {
    const accessToken = conn.access_token as string | null;
    const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : null;
    const updatedAt = conn.updated_at ? new Date(conn.updated_at).getTime() : 0;

    if (!isInstagramNativeToken(accessToken)) {
      results.push({ id: conn.id, organizationId: conn.organization_id, status: "skipped", message: "Token nao e do Instagram Business Login (sem prefixo IGAA/IGQV/IGQ)." });
      continue;
    }
    if (!expiresAt) {
      results.push({ id: conn.id, organizationId: conn.organization_id, status: "skipped", message: "Sem expires_at registrado." });
      continue;
    }
    if (expiresAt - now > refreshWindowMs) {
      results.push({ id: conn.id, organizationId: conn.organization_id, status: "skipped", message: "Token ainda nao entrou na janela de renovacao." });
      continue;
    }
    if (now - updatedAt < minAgeMs) {
      results.push({ id: conn.id, organizationId: conn.organization_id, status: "skipped", message: "Token tem menos de 24h — Meta exige idade minima para renovar." });
      continue;
    }
    if (expiresAt <= now) {
      results.push({ id: conn.id, organizationId: conn.organization_id, status: "expired", message: "Token ja expirado — necessario reconectar manualmente." });
      continue;
    }

    try {
      const refreshUrl = new URL(instagramGraphRefreshTokenUrl());
      refreshUrl.searchParams.set("grant_type", "ig_refresh_token");
      refreshUrl.searchParams.set("access_token", accessToken as string);

      const refreshRes = await fetch(refreshUrl);
      const refreshData = await refreshRes.json().catch(() => ({})) as {
        access_token?: string;
        token_type?: string;
        expires_in?: number;
        error?: { message?: string };
      };
      if (!refreshRes.ok || !refreshData.access_token) {
        throw new Error(refreshData.error?.message || "Falha ao renovar token do Instagram.");
      }

      const newExpiresIn = refreshData.expires_in ?? 60 * 24 * 60 * 60;
      const newExpiresAt = new Date(now + newExpiresIn * 1000).toISOString();
      const updatedAtIso = new Date(now).toISOString();

      const { error: updateError } = await adminClient.from("meta_connections").update({
        access_token: refreshData.access_token,
        expires_at: newExpiresAt,
        updated_at: updatedAtIso
      }).eq("id", conn.id);
      if (updateError) throw updateError;

      results.push({ id: conn.id, organizationId: conn.organization_id, status: "refreshed", expiresAt: newExpiresAt });
    } catch (err) {
      results.push({
        id: conn.id,
        organizationId: conn.organization_id,
        status: "error",
        message: err instanceof Error ? err.message : "Erro desconhecido ao renovar token."
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
