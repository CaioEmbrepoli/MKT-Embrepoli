/**
 * Script one-shot: formata a planilha Google Sheets de clientes igual ao template Excel.
 * - Adiciona colunas de legenda (P + Q) com cores e descrições
 * - Adiciona validações de dropdown para Tipo (C), Frequência (M) e Responsável (N)
 * - Ajusta larguras das colunas
 *
 * Uso: node scripts/format-sheets-legend.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Carregar .env.local ──────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID  = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_SECRET     = process.env.GOOGLE_CLIENT_SECRET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_SECRET) {
  console.error("Variáveis de ambiente não encontradas. Verifique .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Buscar spreadsheetId e token ─────────────────────────────────────────────
const { data: org } = await sb
  .from("organizations")
  .select("clients_sheet_id")
  .limit(1)
  .maybeSingle();

const spreadsheetId = org?.clients_sheet_id;
if (!spreadsheetId) {
  console.error("Nenhuma planilha vinculada encontrada em organizations.");
  process.exit(1);
}
console.log("Spreadsheet:", spreadsheetId);

const { data: conn } = await sb
  .from("google_connections")
  .select("access_token, refresh_token, expires_at")
  .eq("service", "sheets")
  .maybeSingle();

if (!conn?.refresh_token) {
  console.error("Google Sheets não conectado.");
  process.exit(1);
}

// ── Obter access token válido ─────────────────────────────────────────────────
async function getToken() {
  const expiresAt = new Date(conn.expires_at || 0).getTime();
  if (conn.access_token && expiresAt > Date.now() + 60_000) {
    return conn.access_token;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Erro ao renovar token");
  return data.access_token;
}

// ── Helpers Sheets API ────────────────────────────────────────────────────────
async function sheetsGet(path, token) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Sheets GET ${res.status}`);
  return data;
}

async function sheetsBatch(requests, token) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Sheets batchUpdate ${res.status}`);
  return data;
}

async function sheetsUpdateValues(range, values, token) {
  const enc = encodeURIComponent(range);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${enc}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Sheets values PUT ${res.status}`);
  return data;
}

// ── Cores (RGB 0-1) ───────────────────────────────────────────────────────────
const c = (hex) => {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return { red: r, green: g, blue: b };
};
const COLORS = {
  req:      c("B45309"),  // âmbar — header obrigatório
  opt:      c("334155"),  // slate — header opcional
  drop:     c("1D4ED8"),  // azul — header dropdown
  white:    c("FFFFFF"),
  grayBg:   c("E2E8F0"),  // legenda — fundo cinza
  yellowBg: c("FEF08A"),  // obrigatório
  lightBg:  c("F1F5F9"),  // opcional
  blueBg:   c("BFDBFE"),  // dropdown
  text:     c("374151"),  // texto cinza escuro
};

// ── Buscar sheetId da aba "Leads-Clientes" ───────────────────────────────────
const token = await getToken();
const meta  = await sheetsGet("?fields=sheets.properties", token);
const sheet = meta.sheets?.find((s) => s.properties.title === "Leads-Clientes");
if (!sheet) {
  console.error('Aba "Leads-Clientes" não encontrada na planilha.');
  process.exit(1);
}
const sheetId = sheet.properties.sheetId;
console.log("SheetId:", sheetId);

// ── Buscar perfis (vendedores) para dropdown ──────────────────────────────────
const { data: profiles } = await sb
  .from("profiles")
  .select("name")
  .eq("active", true);

const vendedores = ["Sem responsável", ...(profiles ?? []).map((p) => p.name).filter(Boolean)];

// ── 1. Escrever valores da legenda (colunas P=16 e Q=17) ─────────────────────
console.log("Escrevendo legenda...");
await sheetsUpdateValues("Leads-Clientes!P1:Q20", [
  ["LEGENDA",                                    ""],
  ["  Obrigatório — deve ser preenchido",         ""],
  ["  Opcional — pode deixar em branco",          ""],
  ["  Tem seleção automática (dropdown)",         ""],
  ["",                                            ""],
  ["O QUE É CADA COLUNA",                        ""],
  ["Código",               "ID único no seu sistema. Se deixar em branco, o sistema identifica pelo Nome + Telefone."],
  ["Nome Cliente/Empresa", "Nome da pessoa (PF) ou da empresa (PJ)."],
  ["Tipo  PF | PJ",        "Pessoa Física, Pessoa Jurídica"],
  ["Nome do Contato",      "Para PJ: nome do responsável que você vai ligar."],
  ["CPF/CNPJ",             "Documento do cliente. Com ou sem formatação."],
  ["Email",                "Endereço de e-mail do cliente."],
  ["Telefone",             "Com DDD. Ex: 41 99999-0000"],
  ["UF",                   "Sigla do estado. Ex: PR, SP, SC"],
  ["Municipio",            "Cidade do cliente."],
  ["Segmento",             "Ramo de atuação. Ex: Auto Center, Agro, Indústria"],
  ["Ultima Compra",        "Data da última compra no formato DD/MM/AAAA. Deixar vazio se nunca comprou."],
  ["Valor Ultima Compra",  "Valor em reais da última compra. Ex: 1500.00"],
  ["Frequência",           "Com que frequência ligar: Diário, Semanal, Quinzenal ou Mensal."],
  ["Responsável",          "Vendedor responsável pelo acompanhamento deste cliente."],
], token);

// ── 2. Formatar célula por célula via batchUpdate ─────────────────────────────
console.log("Formatando legenda...");

function rgb(color) {
  return color;
}

function cellFmt(rowIdx, colIdx, bgColor, bold = false) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: colIdx, endColumnIndex: colIdx + 2 },
      cell: {
        userEnteredFormat: {
          backgroundColor: rgb(bgColor),
          textFormat: { bold, foregroundColor: rgb(COLORS.text) },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
    },
  };
}

const formatRequests = [
  // P1:Q1 — "LEGENDA" — fundo cinza, negrito
  cellFmt(0, 15, COLORS.grayBg, true),
  // P2:Q2 — obrigatório — amarelo
  cellFmt(1, 15, COLORS.yellowBg),
  // P3:Q3 — opcional — cinza claro
  cellFmt(2, 15, COLORS.lightBg),
  // P4:Q4 — dropdown — azul claro
  cellFmt(3, 15, COLORS.blueBg),
  // P6:Q6 — seção — fundo cinza, negrito
  cellFmt(5, 15, COLORS.grayBg, true),
  // P7:P20 — rótulos (negrito leve)
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 6, endRowIndex: 20, startColumnIndex: 15, endColumnIndex: 16 },
      cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: rgb(COLORS.text) } } },
      fields: "userEnteredFormat(textFormat)",
    },
  },
  // Q7:Q20 — descrições (wrap)
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 6, endRowIndex: 20, startColumnIndex: 16, endColumnIndex: 17 },
      cell: { userEnteredFormat: { wrapStrategy: "WRAP", textFormat: { foregroundColor: rgb(COLORS.text) } } },
      fields: "userEnteredFormat(wrapStrategy,textFormat)",
    },
  },
  // Larguras das colunas P (15) e Q (16)
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: 14, endIndex: 15 }, // O = espaçador
      properties: { pixelSize: 20 },
      fields: "pixelSize",
    },
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: 15, endIndex: 16 }, // P
      properties: { pixelSize: 200 },
      fields: "pixelSize",
    },
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: 16, endIndex: 17 }, // Q
      properties: { pixelSize: 360 },
      fields: "pixelSize",
    },
  },
];

await sheetsBatch(formatRequests, token);

// ── 3. Data Validations (dropdowns) ──────────────────────────────────────────
console.log("Adicionando dropdowns...");

const dropRequests = [
  // Coluna C (índice 2) — Tipo: PF ou PJ
  {
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 10001, startColumnIndex: 2, endColumnIndex: 3 },
      rule: {
        condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "PF" }, { userEnteredValue: "PJ" }] },
        showCustomUi: true,
        strict: false,
      },
    },
  },
  // Coluna M (índice 12) — Frequência
  {
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 10001, startColumnIndex: 12, endColumnIndex: 13 },
      rule: {
        condition: {
          type: "ONE_OF_LIST",
          values: [
            { userEnteredValue: "Diário" },
            { userEnteredValue: "Semanal" },
            { userEnteredValue: "Quinzenal" },
            { userEnteredValue: "Mensal" },
          ],
        },
        showCustomUi: true,
        strict: false,
      },
    },
  },
  // Coluna N (índice 13) — Responsável (lista de profiles)
  {
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 10001, startColumnIndex: 13, endColumnIndex: 14 },
      rule: {
        condition: {
          type: "ONE_OF_LIST",
          values: vendedores.map((name) => ({ userEnteredValue: name })),
        },
        showCustomUi: true,
        strict: false,
      },
    },
  },
];

await sheetsBatch(dropRequests, token);

// ── 4. Congelar linha 1 (se ainda não estiver) ───────────────────────────────
console.log("Congelando linha 1...");
await sheetsBatch([
  {
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: "gridProperties.frozenRowCount",
    },
  },
], token);

console.log("✅ Planilha formatada com sucesso!");
console.log(`   ${vendedores.length} vendedores no dropdown de Responsável.`);
