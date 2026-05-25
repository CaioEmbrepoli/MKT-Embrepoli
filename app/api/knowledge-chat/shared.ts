import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const CHAT_CONFIDENCE_THRESHOLD = 0.30; // threshold para busca por palavras-chave

export type AuthContext = {
  authUserId: string;
  organizationId: string;
  profile: { id: string; name: string; email: string; role: string; active: boolean };
  service: SupabaseClient;
};

export type BankItem = { id: string; questionText: string; answerText: string };
export type AiResult = {
  found: boolean;
  answer: string | null;
  matchedIds: string[];
  confidence: number;
  reason: string;
  provider: "local" | "ollama" | "gemini";
  model: string;
};

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function authContext(request: Request): Promise<AuthContext> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase service role não configurado.");
  }

  const token = bearerToken(request);
  if (!token) throw new Error("Sessão não enviada.");

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Sessão inválida.");

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, organization_id, name, email, role, active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile) throw new Error("Perfil não encontrado.");
  if (!profile.active) throw new Error("Usuário inativo.");

  return {
    authUserId: userData.user.id,
    organizationId: profile.organization_id,
    profile: {
      id: profile.id,
      name: profile.name ?? "",
      email: profile.email ?? "",
      role: profile.role ?? "colaborador",
      active: Boolean(profile.active)
    },
    service
  };
}

export function saoPauloDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function archiveExpiry(from = new Date()) {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + 30);
  return expiresAt.toISOString();
}

export async function ensureTodaySession(ctx: AuthContext) {
  const now = new Date();
  const dateKey = saoPauloDateKey(now);
  const expiresAt = archiveExpiry(now);

  const { data: oldSessions } = await ctx.service
    .from("knowledge_chat_sessions")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", ctx.profile.id)
    .eq("status", "active")
    .neq("date_key", dateKey);

  if (oldSessions?.length) {
    await ctx.service
      .from("knowledge_chat_sessions")
      .update({ status: "archived", archived_at: now.toISOString(), expires_at: expiresAt, updated_at: now.toISOString() })
      .in("id", oldSessions.map((item) => item.id));
  }

  const { data, error } = await ctx.service
    .from("knowledge_chat_sessions")
    .upsert({
      organization_id: ctx.organizationId,
      user_id: ctx.profile.id,
      date_key: dateKey,
      status: "active",
      title: "Chat do dia",
      archived_at: null,
      expires_at: null,
      updated_at: now.toISOString()
    }, { onConflict: "organization_id,user_id,date_key" })
    .select("*")
    .single();
  if (error) throw new Error(`chat session upsert: ${error.message}`);
  return data;
}

export async function loadSessionBundle(service: SupabaseClient, sessionId: string) {
  const [messages, gaps] = await Promise.all([
    service.from("knowledge_chat_messages").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
    service.from("knowledge_gaps").select("*").eq("session_id", sessionId).order("created_at", { ascending: false })
  ]);
  if (messages.error) throw new Error(`chat messages select: ${messages.error.message}`);
  if (gaps.error) throw new Error(`knowledge gaps select: ${gaps.error.message}`);
  return {
    messages: messages.data ?? [],
    gaps: gaps.data ?? []
  };
}

export async function loadAnswerBank(ctx: AuthContext): Promise<BankItem[]> {
  const { data, error } = await ctx.service
    .from("customer_questions")
    .select("id, question_text, answer_text")
    .eq("organization_id", ctx.organizationId)
    .eq("status", "aprovado")
    .not("answer_text", "is", null)
    .neq("answer_text", "");
  if (error) throw new Error(`customer_questions select: ${error.message}`);
  return (data ?? []).map((item) => ({
    id: item.id,
    questionText: item.question_text ?? "",
    answerText: item.answer_text ?? ""
  })).filter((item) => item.questionText.trim() && item.answerText.trim());
}

// ── Busca por palavras-chave (sem IA) ────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palavras muito comuns que não ajudam na busca
const STOPWORDS = new Set(["o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das",
  "e", "em", "no", "na", "nos", "nas", "para", "por", "com", "que", "se", "ao", "aos",
  "as", "ate", "ou", "mas", "mais", "como", "tem", "ter", "faz", "fazer", "esse", "esta",
  "isso", "qual", "quais", "quando", "onde", "quanto", "quantos", "este", "aqui", "la"]);

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function jaccardScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export function searchBank(question: string, bank: BankItem[]): AiResult {
  if (!bank.length) {
    return { found: false, answer: null, matchedIds: [], confidence: 0, reason: "Banco de dúvidas vazio.", provider: "local", model: "keyword-search" };
  }

  const queryTokens = tokenize(question);
  let best: { item: BankItem; score: number } | null = null;

  for (const item of bank) {
    const qTokens = tokenize(item.questionText);
    const aTokens = tokenize(item.answerText);
    // pontua contra a pergunta E contra a resposta (com peso menor)
    const score = Math.max(jaccardScore(queryTokens, qTokens), jaccardScore(queryTokens, aTokens) * 0.6);
    if (!best || score > best.score) best = { item, score };
  }

  if (!best || best.score < CHAT_CONFIDENCE_THRESHOLD) {
    return { found: false, answer: null, matchedIds: [], confidence: best?.score ?? 0, reason: "Nenhuma correspondência encontrada.", provider: "local", model: "keyword-search" };
  }

  return {
    found: true,
    answer: best.item.answerText,
    matchedIds: [best.item.id],
    confidence: best.score,
    reason: `Correspondência por palavras-chave (score ${(best.score * 100).toFixed(0)}%)`,
    provider: "local",
    model: "keyword-search"
  };
}

// Mantido como alias para compatibilidade com send/route.ts
export async function askKnowledgeAi(question: string, bank: BankItem[]): Promise<AiResult> {
  return searchBank(question, bank);
}

export function mapSession(row: any) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    dateKey: row.date_key,
    status: row.status,
    title: row.title,
    archivedAt: row.archived_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    lastMessageAt: row.last_message_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapMessage(row: any) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    unknown: row.unknown ?? false,
    confidence: row.confidence ?? undefined,
    reason: row.reason ?? undefined,
    gapId: row.gap_id ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at
  };
}

export function mapGap(row: any) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sessionId: row.session_id,
    userId: row.user_id,
    questionText: row.question_text,
    status: row.status,
    customerQuestionId: row.customer_question_id ?? undefined,
    answeredAt: row.answered_at ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
