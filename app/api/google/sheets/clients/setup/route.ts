import { NextResponse } from "next/server";
import {
  googleRequestContext,
  requireGoogleManager,
  getGoogleAccessToken,
} from "@/lib/google-server";
import {
  CLIENTS_SHEET_NAME,
  CLIENTS_SHEET_HEADERS,
  dbClientToSheetRow,
} from "@/lib/sheets-clients";

export const dynamic = "force-dynamic";

/**
 * GET /api/google/sheets/clients/setup
 *
 * Retorna status da planilha de clientes da organização:
 * - sheetsConnected: se Google Sheets está vinculado
 * - spreadsheetId / spreadsheetUrl: planilha atual (null se não criada)
 */
export async function GET(request: Request) {
  try {
    const context = await googleRequestContext(request);

    const [connRes, orgRes] = await Promise.all([
      context.service
        .from("google_connections")
        .select("id")
        .eq("organization_id", context.organizationId)
        .eq("service", "sheets")
        .maybeSingle(),
      context.service
        .from("organizations")
        .select("clients_sheet_id, clients_sheet_url")
        .eq("id", context.organizationId)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      sheetsConnected: Boolean(connRes.data),
      spreadsheetId: (orgRes.data?.clients_sheet_id as string | null) ?? null,
      spreadsheetUrl: (orgRes.data?.clients_sheet_url as string | null) ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao verificar status." },
      { status: 401 }
    );
  }
}

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
 * POST /api/google/sheets/clients/setup
 *
 * Cria a planilha Google Sheets de clientes (se ainda não existir) e exporta
 * todos os clientes da organização. Salva spreadsheetId e URL em organizations.
 *
 * Requer: admin ou gestor autenticado com Google Sheets conectado.
 */
export async function POST(request: Request) {
  try {
    const context = await googleRequestContext(request);
    requireGoogleManager(context);
    const token = await getGoogleAccessToken(context, "sheets");

    // Verificar se já existe planilha vinculada
    const { data: org } = await context.service
      .from("organizations")
      .select("id, clients_sheet_id, clients_sheet_url")
      .eq("id", context.organizationId)
      .maybeSingle();

    let spreadsheetId = (org?.clients_sheet_id as string | null) ?? null;
    let spreadsheetUrl = (org?.clients_sheet_url as string | null) ?? null;

    if (!spreadsheetId) {
      // Criar nova planilha
      const created = await sheetsRequest(
        "POST",
        "https://sheets.googleapis.com/v4/spreadsheets",
        token,
        {
          properties: { title: "Clientes — Embrepoli" },
          sheets: [
            {
              properties: {
                title: CLIENTS_SHEET_NAME,
                sheetId: 0,
                index: 0,
              },
            },
          ],
        }
      );
      spreadsheetId = String(created.spreadsheetId);
      spreadsheetUrl = String(created.spreadsheetUrl);

      // Salvar na organização
      await context.service
        .from("organizations")
        .update({
          clients_sheet_id: spreadsheetId,
          clients_sheet_url: spreadsheetUrl,
        })
        .eq("id", context.organizationId);
    }

    // Escrever cabeçalho
    await sheetsRequest(
      "PUT",
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        CLIENTS_SHEET_NAME
      )}!A1:N1?valueInputOption=RAW`,
      token,
      { values: [Array.from(CLIENTS_SHEET_HEADERS)] }
    );

    // Formatar cabeçalho (negrito + fundo azul escuro + texto branco)
    await sheetsRequest(
      "POST",
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      token,
      {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: CLIENTS_SHEET_HEADERS.length,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.106, green: 0.212, blue: 0.494 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                  },
                },
              },
              fields:
                "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      }
    );

    // Buscar clientes, perfis e agendas para exportar
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

    // Limpar dados existentes e escrever novos
    await sheetsRequest(
      "PUT",
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        CLIENTS_SHEET_NAME
      )}!A2:N?valueInputOption=USER_ENTERED`,
      token,
      {
        values:
          clients.length > 0
            ? clients.map((c) =>
                dbClientToSheetRow(
                  c,
                  profileNames,
                  clientFreqs.get(String(c.id ?? ""))
                )
              )
            : [[""]],
      }
    );

    return NextResponse.json({
      spreadsheetId,
      spreadsheetUrl,
      rows: clients.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao configurar planilha." },
      { status: 500 }
    );
  }
}
