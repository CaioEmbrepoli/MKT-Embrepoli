// Helpers para conversão entre SalesClient e linhas do Google Sheets.
// Usado pelos routes /api/google/sheets/clients/*.

export const CLIENTS_SHEET_NAME = "Leads-Clientes";

export const CLIENTS_SHEET_HEADERS = [
  "Código",
  "Nome Cliente/Empresa",
  "Tipo",
  "Nome do Contato",
  "CPF/CNPJ",
  "Email",
  "Telefone",
  "UF",
  "Municipio",
  "Segmento",
  "Ultima Compra",
  "Valor Ultima Compra",
  "Frequência",
  "Responsável",
] as const;

// ─── Frequência ────────────────────────────────────────────────────────────────

const FREQ_TO_LABEL: Record<string, string> = {
  daily: "Diario",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

function frequencyLabel(freq: string): string {
  return FREQ_TO_LABEL[freq] ?? freq;
}

function parseFrequency(
  raw: string
): "daily" | "weekly" | "biweekly" | "monthly" | undefined {
  const v = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (v === "diario" || v === "diaria") return "daily";
  if (v === "semanal") return "weekly";
  if (v === "quinzenal") return "biweekly";
  if (v === "mensal") return "monthly";
  return undefined;
}

// ─── Datas ─────────────────────────────────────────────────────────────────────

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function displayToIso(raw: string): string {
  if (!raw || raw === "01/01/0001") return "";
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, dd, mm, yyyy] = match;
  if (yyyy === "0001") return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// ─── DB row (snake_case) → array de células ────────────────────────────────────

/**
 * Recebe uma linha raw do Supabase (sales_clients, snake_case) e retorna
 * um array de 14 células para escrever no Google Sheets.
 */
export function dbClientToSheetRow(
  row: Record<string, unknown>,
  profileNames: Map<string, string>,
  frequency?: string
): string[] {
  const cpfCnpj =
    (row.cpf as string | null) || (row.cnpj as string | null) || "";

  return [
    String(row.external_code ?? ""),
    String(row.name ?? ""),
    String(row.client_type ?? ""),
    String(row.company ?? ""),
    cpfCnpj,
    String(row.email ?? ""),
    String(row.phone ?? ""),
    String(row.state_uf ?? ""),
    String(row.city ?? ""),
    String(row.segment ?? ""),
    isoToDisplay(String(row.last_purchase_at ?? "")),
    row.last_purchase_value != null ? String(row.last_purchase_value) : "",
    frequency ? frequencyLabel(frequency) : "",
    profileNames.get(String(row.assigned_to ?? "")) ?? "",
  ];
}

// ─── Array de células → ImportedSalesClientRow ─────────────────────────────────

export type SheetImportedRow = {
  rowNumber: number;
  externalCode: string;
  name: string;
  clientType: string;
  contactName?: string;
  cpfCnpj?: string;
  email?: string;
  phone: string;
  stateUf: string;
  city: string;
  segment?: string;
  lastPurchaseAt: string;
  lastPurchaseValue?: number;
  frequency?: "daily" | "weekly" | "biweekly" | "monthly";
  assignedToName?: string;
};

function cleanCell(val: unknown): string {
  return String(val ?? "")
    .replace(/ /g, " ")
    .trim()
    .replace(/^'/, "");
}

/**
 * Converte uma linha do Sheets (já sem a linha de cabeçalho) para o formato
 * compatível com `importClients()` no frontend.
 * Retorna null se a linha estiver vazia.
 */
export function sheetRowToImportedRow(
  row: string[],
  rowNumber: number
): SheetImportedRow | null {
  const cells = row.map(cleanCell);
  const [
    externalCode,
    name,
    clientType,
    contactName,
    cpfCnpj,
    email,
    phone,
    stateUf,
    city,
    segment,
    lastPurchaseRaw,
    valueRaw,
    freqRaw,
    assignedToName,
  ] = cells;

  if (!name) return null;

  const lastPurchaseValue = valueRaw
    ? parseFloat(valueRaw.replace(/[^\d,.]/g, "").replace(",", ".")) ||
      undefined
    : undefined;

  return {
    rowNumber,
    externalCode: externalCode ?? "",
    name,
    clientType: clientType ?? "",
    contactName: contactName || undefined,
    cpfCnpj: cpfCnpj || undefined,
    email: email || undefined,
    phone: phone ?? "",
    stateUf: stateUf ?? "",
    city: city ?? "",
    segment: segment || undefined,
    lastPurchaseAt: displayToIso(lastPurchaseRaw ?? ""),
    lastPurchaseValue,
    frequency: freqRaw ? parseFrequency(freqRaw) : undefined,
    assignedToName: assignedToName || undefined,
  };
}
