import type { SupabaseClient } from "@supabase/supabase-js";

// ── Integração Tray Commerce — consulta de preço em tempo real ──────────────
//
// Opcional/configurável: se a organização não tiver uma linha em
// `tray_integration`, `getTrayToken` retorna `null` e o RAG segue sem
// contexto de preço (comportamento atual preservado).

export type TrayToken = { apiAddress: string; accessToken: string };

export type TrayProduct = {
  name: string;
  price: number;
  promotionalPrice?: number;
  available: boolean;
};

const REFRESH_MARGIN_MS = 20 * 60 * 1000; // renovar se faltar menos de 20min para expirar

export async function getTrayToken(service: SupabaseClient, organizationId: string): Promise<TrayToken | null> {
  const { data, error } = await service
    .from("tray_integration")
    .select("api_address, access_token, refresh_token, expires_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return { apiAddress: data.api_address, accessToken: data.access_token };
  }

  try {
    const refreshUrl = `${data.api_address}/auth?refresh_token=${encodeURIComponent(data.refresh_token)}`;
    const res = await fetch(refreshUrl);
    if (!res.ok) return { apiAddress: data.api_address, accessToken: data.access_token };

    const refreshed = await res.json() as { access_token?: string; refresh_token?: string; date_expiration?: string };
    if (!refreshed.access_token) return { apiAddress: data.api_address, accessToken: data.access_token };

    const newExpiresAt = refreshed.date_expiration ?? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    await service
      .from("tray_integration")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? data.refresh_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq("organization_id", organizationId);

    return { apiAddress: data.api_address, accessToken: refreshed.access_token };
  } catch {
    // se a renovação falhar, tenta com o token atual (pode ainda funcionar por alguns minutos)
    return { apiAddress: data.api_address, accessToken: data.access_token };
  }
}

export async function searchTrayProduct(apiAddress: string, accessToken: string, query: string): Promise<TrayProduct | null> {
  try {
    const url = `${apiAddress}/products?access_token=${encodeURIComponent(accessToken)}&search=${encodeURIComponent(query)}&attrs=id,name,price,promotional_price,available`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json() as { Products?: Array<{ Product?: Record<string, unknown> }> };
    const first = data.Products?.[0]?.Product;
    if (!first) return null;

    const name = String(first.name ?? "").trim();
    const price = Number(first.price ?? 0);
    const promotionalPriceRaw = Number(first.promotional_price ?? 0);
    const available = first.available === "1" || first.available === 1 || first.available === true;

    if (!name || !Number.isFinite(price) || price <= 0) return null;

    return {
      name,
      price,
      promotionalPrice: promotionalPriceRaw > 0 ? promotionalPriceRaw : undefined,
      available
    };
  } catch {
    return null;
  }
}
