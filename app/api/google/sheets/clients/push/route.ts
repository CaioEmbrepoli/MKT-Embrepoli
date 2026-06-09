import { NextResponse } from "next/server";
import {
  googleRequestContext,
  getGoogleAccessToken,
} from "@/lib/google-server";
import {
  CLIENTS_SHEET_NAME,
  CLIENTS_SHEET_HEADERS,
  dbClientToSheetRow,
} from "@/lib/sheets-clients";

export const dynamic = "force-dynamic";

async function sheetsRequest(
  method: string,
  url: string,
  token: string,
  body?: unknown
) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { error?: { message?: string } })?.error?.message ??
        `Sheets API ${res.status}`
    );
  }
  return data as Record<string, unknown>;
}

/**
 * POST /api/google/sheets/clients/push
 *
 * Sincroniza todos os clientes do sistema para a planilha Google Sheets
 * vinculada à organização. Fire-and-forget: chamado após cada save/import.
 *
 * Requer: qualquer usuário autenticado com Google Sheets conectado.
 */
export async function POST(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const token = await getGoogleAccessToken(context, "sheets");

    // Buscar spreadsheetId da org
    const { data: org } = await context.service
      .from("organizations")
      .select("clients_sheet_id")
      .eq("id", context.organizationId)
      .maybeSingle();

    const spreadsheetId = (org?.clients_sheet_id as string | null) ?? null;
    if (!spreadsheetId) {
      return NextResponse.json(
        { ok: false, message: "Planilha não configurada. Use /setup primeiro." },
        { status: 400 }
      );
    }

    // Buscar clientes, perfis e agendas
    const [clientsRes, profilesRes, schedulesRes] = await Promise.all([
      context.service
        .from("sales_clients")
        .select("*")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true }),
      context.service
        .from("profiles")
        .select("id, name")
        .eq("organization_id", context.organizationId),
      context.service
        .from("call_schedules")
        .select("client_id, frequency")
        .eq("organization_id", context.organizationId)
        .eq("active", true),
    ]);

    const clients = (clientsRes.data ?? []) as Record<string, unknown>[];
    const profiles = (profilesRes.data ?? []) as { id: string; name: string }[];
    const schedules = (schedulesRes.data ?? []) as { client_id: string; frequency: string }[];

    const profileNames = new Map(profiles.map((p) => [p.id, p.name]));
    const clientFreqs = new Map(schedules.map((s) => [s.client_id, s.frequency]));

    // Limpar dados (A2:N) e reescrever — garante que linhas deletadas somam
    await sheetsRequest(
      "PUT",
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        CLIENTS_SHEET_NAME
      )}!A1:N?valueInputOption=USER_ENTERED`,
      token,
      {
        values: [
          Array.from(CLIENTS_SHEET_HEADERS),
          ...clients.map((c) =>
            dbClientToSheetRow(
              c,
              profileNames,
              clientFreqs.get(String(c.id ?? ""))
            )
          ),
        ],
      }
    );

    // Se havia mais linhas antes, limpar o excesso (clear range além dos dados)
    if (clients.length < 5000) {
      const clearFrom = clients.length + 2; // linha 1 = header, dados começam em 2
      await sheetsRequest(
        "POST",
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
          CLIENTS_SHEET_NAME
        )}!A${clearFrom}:N:clear`,
        token
      ).catch(() => {
        // Ignorar erros de limpeza — não crítico
      });
    }

    return NextResponse.json({ ok: true, rows: clients.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao sincronizar planilha." },
      { status: 500 }
    );
  }
}
