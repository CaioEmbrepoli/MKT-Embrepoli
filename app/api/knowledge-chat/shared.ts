import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getTrayToken, searchTrayProduct } from "@/lib/tray-api";

export const CHAT_CONFIDENCE_THRESHOLD = 0.30; // threshold para busca por palavras-chave

export type AuthContext = {
  authUserId: string;
  organizationId: string;
  profile: { id: string; name: string; email: string; role: string; active: boolean };
  service: SupabaseClient;
};

export type BankItem = { id: string; questionText: string; answerText: string; videoTitle?: string };
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
    .select("id, question_text, answer_text, video_title")
    .eq("organization_id", ctx.organizationId)
    .eq("status", "aprovado")
    .not("answer_text", "is", null)
    .neq("answer_text", "");
  if (error) throw new Error(`customer_questions select: ${error.message}`);
  return (data ?? []).map((item) => ({
    id: item.id,
    questionText: item.question_text ?? "",
    answerText: item.answer_text ?? "",
    videoTitle: item.video_title ?? ""
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

// Palavras genéricas que aparecem com frequência em títulos de vídeo (em title case)
// e não devem ser tratadas como nome de modelo/produto.
const GENERIC_TITLE_WORDS = new Set(["tutorial", "video", "parte", "instalacao", "instalando",
  "manometro", "pressao", "kit", "kits", "intercooler", "turbo", "caminhao", "caminhonete",
  "trator", "tratores", "aumento", "ganho", "potencia", "teste", "testando", "resultado",
  "resultados", "antes", "depois", "dica", "dicas", "diesel", "motor", "remap", "remapeamento"]);

// Tokens que provavelmente identificam um modelo/produto (veículo, trator, etc.):
// palavras com dígito (ex.: "S10", "MF275", "4x4") ou nomes próprios (iniciam com
// maiúscula fora do começo da frase, ex.: "Hilux", "Ranger", "Valtra").
function extractEntityTokens(text: string): Set<string> {
  const raw = String(text ?? "");
  const words = raw.split(/\s+/).filter(Boolean);
  const entities = new Set<string>();
  words.forEach((word, index) => {
    const cleaned = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (cleaned.length < 3) return;
    const hasDigit = /\d/.test(cleaned);
    const isCapitalized = index > 0 && /^[A-ZÀ-Ý]/.test(cleaned);
    if (hasDigit || isCapitalized) {
      const normalized = normalizeText(cleaned);
      if (normalized && !STOPWORDS.has(normalized) && !GENERIC_TITLE_WORDS.has(normalized)) {
        entities.add(normalized);
      }
    }
  });
  return entities;
}

function jaccardScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

type RankedBankItem = { item: BankItem; score: number; intersects: boolean };

function rankBank(question: string, bank: BankItem[], context?: { videoTitle?: string }): RankedBankItem[] {
  const queryTokens = tokenize(question);
  const queryEntities = extractEntityTokens(`${question} ${context?.videoTitle ?? ""}`);
  const ranked: RankedBankItem[] = [];

  for (const item of bank) {
    const itemEntities = extractEntityTokens(`${item.questionText} ${item.videoTitle ?? ""}`);
    let intersects = false;
    for (const e of queryEntities) if (itemEntities.has(e)) { intersects = true; break; }
    if (queryEntities.size && itemEntities.size && !intersects) continue; // perguntas sobre modelos/produtos diferentes não se confundem

    const qTokens = tokenize(item.questionText);
    const aTokens = tokenize(item.answerText);
    const vTokens = tokenize(item.videoTitle ?? "");
    // pontua contra pergunta (1.0), resposta (0.6) e título do vídeo (0.4 — contexto de produto)
    let score = Math.max(
      jaccardScore(queryTokens, qTokens),
      jaccardScore(queryTokens, aTokens) * 0.6,
      jaccardScore(queryTokens, vTokens) * 0.4
    );
    if (intersects) score = Math.min(1, score + 0.25);
    ranked.push({ item, score, intersects });
  }

  return ranked.sort((a, b) => b.score - a.score);
}

export function searchBank(question: string, bank: BankItem[], context?: { videoTitle?: string }): AiResult {
  if (!bank.length) {
    return { found: false, answer: null, matchedIds: [], confidence: 0, reason: "Banco de dúvidas vazio.", provider: "local", model: "keyword-search" };
  }

  const best = rankBank(question, bank, context)[0];

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

// ── IA generativa com banco como referência (RAG simples) ───────────────────

const OLLAMA_HOST = process.env.OLLAMA_HOST?.replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
const MAX_BANK_CONTEXT = 8;

function buildAiPrompt(question: string, candidates: BankItem[], context?: { videoTitle?: string }, priceContext?: string): string {
  const bankText = candidates
    .map((item, i) => `${i + 1}. [id:${item.id}] P: ${item.questionText}\nR: ${item.answerText}${item.videoTitle ? `\nVideo: ${item.videoTitle}` : ""}`)
    .join("\n\n");

  const videoContext = context?.videoTitle ? `\nO comentário foi feito no vídeo/post: "${context.videoTitle}"` : "";
  const priceSection = priceContext ? `\n\nPreço atualizado da loja (priorize esta informação sobre as referências em caso de conflito):\n${priceContext}` : "";

  return `Você é um atendente da Embrepoli, empresa de kits turbo e intercooler para motores diesel (veicular e agrícola).
Use SOMENTE as referências abaixo (perguntas e respostas já aprovadas) como FONTE DE INFORMAÇÃO para responder à pergunta do cliente.

REGRA MAIS IMPORTANTE: NUNCA copie ou repita o texto de "R:" literalmente, palavra por palavra. As referências foram escritas para OUTRAS perguntas, com outras palavras. Você DEVE reescrever a informação com suas próprias palavras, em uma frase nova, curta e natural, como se estivesse respondendo a pergunta específica do cliente pela primeira vez.

Não invente informações que não estejam nas referências.${videoContext}${priceSection}

Referências:
${bankText}

Pergunta do cliente: ${question}

Se as referências cobrirem a pergunta, retorne:
{"found": true, "answer": "resposta adaptada em portugues", "matchedIds": ["id1","id2"]}

Se as referências não forem suficientes para responder com segurança, retorne:
{"found": false, "answer": null, "matchedIds": []}

Retorne SOMENTE o JSON, sem texto adicional.`;
}

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, format: "json" })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama respondeu ${res.status}: ${body}`);
  }
  const data = await res.json() as { response?: string };
  return data.response?.trim() ?? "{}";
}

async function callGemini(prompt: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" }
  });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

const PRICE_INTENT_KEYWORDS = new Set(["preco", "precos", "valor", "valores", "quanto", "custa", "custo", "custam"]);

function hasPriceIntent(text: string): boolean {
  const tokens = tokenize(text);
  for (const t of tokens) if (PRICE_INTENT_KEYWORDS.has(t)) return true;
  return false;
}

async function buildTrayPriceContext(question: string, ctx: AuthContext, context?: { videoTitle?: string }): Promise<string | undefined> {
  if (!hasPriceIntent(question)) return undefined;

  const tray = await getTrayToken(ctx.service, ctx.organizationId);
  if (!tray) return undefined;

  const entities = extractEntityTokens(`${question} ${context?.videoTitle ?? ""}`);
  if (!entities.size) return undefined;

  const product = await searchTrayProduct(tray.apiAddress, tray.accessToken, Array.from(entities).join(" "));
  if (!product) return undefined;

  const price = product.promotionalPrice ?? product.price;
  return `${product.name} — R$ ${price.toFixed(2)}${product.available ? "" : " (sem estoque no momento)"}`;
}

async function askAiWithBank(question: string, bank: BankItem[], context?: { videoTitle?: string }, ctx?: AuthContext): Promise<AiResult> {
  const ranked = rankBank(question, bank, context);
  const candidates = (ranked.length ? ranked.map((r) => r.item) : bank).slice(0, MAX_BANK_CONTEXT);

  const priceContext = ctx ? await buildTrayPriceContext(question, ctx, context).catch(() => undefined) : undefined;
  const prompt = buildAiPrompt(question, candidates, context, priceContext);
  const provider = OLLAMA_HOST ? "ollama" : "gemini";
  const model = OLLAMA_HOST ? OLLAMA_MODEL : "gemini-2.0-flash";

  const text = OLLAMA_HOST ? await callOllama(prompt) : await callGemini(prompt);
  const parsed = JSON.parse(text) as { found?: boolean; answer?: string | null; matchedIds?: unknown };

  const found = parsed.found === true && typeof parsed.answer === "string" && parsed.answer.trim().length > 0;
  const candidateIds = new Set(candidates.map((c) => c.id));
  const matchedIds = Array.isArray(parsed.matchedIds)
    ? parsed.matchedIds.filter((x): x is string => typeof x === "string" && candidateIds.has(x))
    : [];

  if (!found) {
    return { found: false, answer: null, matchedIds: [], confidence: 0, reason: "IA não encontrou correspondência segura no banco.", provider, model };
  }

  return {
    found: true,
    answer: (parsed.answer as string).trim(),
    matchedIds,
    confidence: 0.9,
    reason: "Resposta gerada por IA com base no Banco de Dúvidas.",
    provider,
    model
  };
}

export async function askKnowledgeAi(question: string, bank: BankItem[], context?: { videoTitle?: string }, ctx?: AuthContext): Promise<AiResult> {
  if (!bank.length) return searchBank(question, bank, context);
  try {
    return await askAiWithBank(question, bank, context, ctx);
  } catch (err) {
    console.error("[knowledge-chat] askAiWithBank falhou, usando busca por palavras-chave", err);
    return searchBank(question, bank, context);
  }
}

// ── Classificação de comentários (pergunta vs. reação social) ───────────────

const QUESTION_KEYWORDS = new Set([
  "preco", "precos", "valor", "valores", "quanto", "cuanto", "custa", "custo", "custam",
  "comprar", "venda", "vende", "vendem", "onde", "frete", "entrega", "entregam",
  "disponivel", "disponibilidade", "tem", "possui", "possuem", "funciona", "funcionam",
  "instala", "instalacao", "garantia", "prazo", "parcela", "parcelamento", "desconto",
  "modelo", "compativel", "compativeis", "compatibilidade", "qual", "quais", "como",
  "voces", "aceita", "aceitam", "whatsapp", "contato", "loja", "pix", "cartao", "duvida"
]);

// Palavras tipicamente usadas em elogios/reações curtas (sem pedir nenhuma informação).
const SOCIAL_KEYWORDS = new Set([
  "show", "top", "massa", "lindo", "linda", "demais", "incrivel", "sensacional",
  "maravilhoso", "maravilhosa", "perfeito", "perfeita", "excelente", "otimo", "otima",
  "parabens", "obrigado", "obrigada", "valeu", "boa", "bom", "legal", "daora",
  "sucesso", "fera", "monstro", "brabo", "brabissimo", "lenda", "campeao", "feras"
]);

function classifyCommentHeuristic(text: string): "question" | "social" | "ambiguous" {
  const stripped = text.replace(/\p{Extended_Pictographic}/gu, "").trim();
  if (!stripped) return "social";
  if (stripped.includes("?")) return "question";
  const tokens = tokenize(stripped);
  for (const t of tokens) if (QUESTION_KEYWORDS.has(t)) return "question";
  if (tokens.size <= 4) {
    for (const t of tokens) if (SOCIAL_KEYWORDS.has(t)) return "social";
    if (!tokens.size) return "social"; // só emojis/pontuação, sem palavras
    return "ambiguous"; // poucas palavras mas nenhuma reconhecida — deixa a IA decidir
  }
  return "ambiguous";
}

async function classifyCommentWithAi(text: string): Promise<"question" | "social"> {
  const prompt = `Classifique o comentário de um cliente abaixo, feito num post de rede social da Embrepoli (empresa de kits turbo/intercooler para motores diesel).

Comentário: "${text}"

Retorne "pergunta" se o comentário pede alguma informação (preço, disponibilidade, dúvida técnica, prazo, etc.).
Retorne "social" se o comentário é apenas uma reação, elogio, emoji ou comentário social, sem pedir nada.

Retorne SOMENTE o JSON: {"type": "pergunta"} ou {"type": "social"}`;

  try {
    const raw = OLLAMA_HOST ? await callOllama(prompt) : await callGemini(prompt);
    const parsed = JSON.parse(raw) as { type?: string };
    return parsed.type === "pergunta" ? "question" : "social";
  } catch {
    return "social"; // fallback seguro: evita puxar o banco de dúvidas para algo que pode não ser pergunta
  }
}

async function askSocialReply(text: string, context?: { videoTitle?: string }): Promise<AiResult> {
  const videoContext = context?.videoTitle ? `\nO comentário foi feito no post: "${context.videoTitle}"` : "";
  const prompt = `Você é o atendente de redes sociais da Embrepoli, empresa de kits turbo e intercooler para motores diesel (veicular e agrícola).
Um cliente deixou o comentário abaixo (elogio, reação ou comentário social, sem pedir informação).${videoContext}

Comentário: "${text}"

Escreva uma resposta curta, simpática e natural para esse comentário (1 frase, pode usar emoji com moderação). NÃO mencione preços, produtos específicos ou informações técnicas — apenas reaja/agradeça no mesmo tom do comentário.

Retorne SOMENTE o JSON: {"answer": "sua resposta aqui"}`;

  const provider = OLLAMA_HOST ? "ollama" : "gemini";
  const model = OLLAMA_HOST ? OLLAMA_MODEL : "gemini-2.0-flash";
  const raw = OLLAMA_HOST ? await callOllama(prompt) : await callGemini(prompt);
  const parsed = JSON.parse(raw) as { answer?: string };
  const answer = (parsed.answer ?? "").trim();
  if (!answer) throw new Error("IA não retornou resposta social.");

  return {
    found: true,
    answer,
    matchedIds: [],
    confidence: 0.95,
    reason: "Resposta social gerada por IA (comentário sem pedido de informação).",
    provider,
    model
  };
}

export async function suggestReplyForComment(text: string, bank: BankItem[], context?: { videoTitle?: string }, ctx?: AuthContext): Promise<AiResult> {
  const cleanText = text.trim();
  if (!cleanText) {
    return { found: false, answer: null, matchedIds: [], confidence: 0, reason: "Comentário vazio.", provider: "local", model: "heuristic" };
  }

  let intent = classifyCommentHeuristic(cleanText);
  if (intent === "ambiguous") intent = await classifyCommentWithAi(cleanText);

  if (intent === "social") {
    try {
      return await askSocialReply(cleanText, context);
    } catch (err) {
      console.error("[suggest-reply] askSocialReply falhou", err);
      return { found: false, answer: null, matchedIds: [], confidence: 0, reason: "Não foi possível gerar resposta social.", provider: "local", model: "heuristic" };
    }
  }

  return askKnowledgeAi(cleanText, bank, context, ctx);
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
