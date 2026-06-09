import { NextResponse } from "next/server";
import {
  googleRequestContext,
  getGoogleAccessToken,
} from "@/lib/google-server";
import {
  CLIENTS_SHEET_NAME,
  sheetRowToImportedRow,
  type SheetImportedRow,
} from "@/lib/sheets-clients";

export const dynamic = "force-dynamic";

/**
 * GET /api/google/sheets/clients/sync
 *
 * Lê a planilha Google Sheets da organização e retorna as linhas como
 * ImportedSalesClientRow[] para o frontend fazer o merge via importClients().
 *
 * Requer: qualquer usuário autenticado com Google Sheets conectado.
 */
export async function GET(request: Request) {
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
        { error: "Planilha não configurada. Use /setup primeiro." },
        { status: 400 }
      );
    }

    // Ler todas as linhas (A1:N limita a 14 colunas = exato nosso range)
    const range = `${CLIENTS_SHEET_NAME}!A1:N`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        range
      )}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        (data as { error?: { message?: string } })?.error?.message ??
          `Sheets API ${res.status}`
      );
    }

    const allRows = ((data as { values?: unknown[][] }).values ?? []) as string[][];

    // Primeira linha é o cabeçalho — pular
    const dataRows = allRows.slice(1);

    const rows: SheetImportedRow[] = [];
    dataRows.forEach((row, index) => {
      const parsed = sheetRowToImportedRow(row, index + 2);
      if (parsed) rows.push(parsed);
    });

    return NextResponse.json({ rows, total: rows.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao ler planilha." },
      { status: 500 }
    );
  }
}
