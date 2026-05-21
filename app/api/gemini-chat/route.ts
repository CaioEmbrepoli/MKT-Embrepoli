import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/gemini-chat
 *
 * Chat de dúvidas com contexto do banco de perguntas.
 * Retorna { answer, matchedQuestionIds, unknown, provider }.
 *
 * Variáveis de ambiente:
 *   OLLAMA_HOST  = URL do Ollama (ex: https://seu-tunel.trycloudflare.com)
 *   OLLAMA_MODEL = modelo a usar (padrão: llama3.2)
 *   GEMINI_API_KEY = chave do Gemini (fallback)
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST?.replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

type BankItem = { id: string; questionText: string; answerText: string };
type AiResult = { found: boolean; answer: string | null; matchedIds: string[] };

function buildPrompt(question: string, bank: BankItem[]): string {
  const bankText = bank.length
    ? bank.map((item, i) => `${i + 1}. [id:${item.id}] P: ${item.questionText}\nR: ${item.answerText}`).join("\n\n")
    : "(banco vazio)";

  return `Voce e um assistente da Embrepoli, empresa de kits turbo e intercooler para motores diesel.
Usando SOMENTE o banco de perguntas e respostas abaixo, responda a pergunta do usuario.

Banco:
${bankText}

Pergunta do usuario: ${question}

Se encontrar correspondencia no banco, retorne este JSON:
{"found": true, "answer": "resposta adaptada", "matchedIds": ["id1"]}

Se nao encontrar correspondencia suficiente, retorne:
{"found": false, "answer": null, "matchedIds": []}

Retorne SOMENTE o JSON, sem texto adicional.`;
}

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: "json",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama respondeu ${res.status}: ${body}`);
  }
  const data = await res.json() as { response?: string };
  return data.response?.trim() ?? "{}";
}

async function callGemini(prompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

function parseResult(text: string): AiResult {
  try {
    const parsed = JSON.parse(text) as Partial<AiResult>;
    const found = parsed.found === true;
    const answer = found && typeof parsed.answer === "string" && parsed.answer.trim()
      ? parsed.answer.trim()
      : null;
    const matchedIds = Array.isArray(parsed.matchedIds)
      ? parsed.matchedIds.filter((x): x is string => typeof x === "string")
      : [];
    return { found: answer !== null, answer, matchedIds };
  } catch {
    return { found: false, answer: null, matchedIds: [] };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { question, bank } = await req.json() as {
      question: string;
      bank: BankItem[];
    };

    if (!question?.trim()) {
      return NextResponse.json({ error: "Pergunta vazia." }, { status: 400 });
    }

    const prompt = buildPrompt(question, bank ?? []);

    const provider = OLLAMA_HOST ? "ollama" : "gemini";
    console.log(`[ai-chat] usando ${provider} (model: ${OLLAMA_HOST ? OLLAMA_MODEL : "gemini-2.0-flash"})`);

    const text = OLLAMA_HOST ? await callOllama(prompt) : await callGemini(prompt);
    const result = parseResult(text);

    return NextResponse.json({
      answer: result.answer,
      matchedQuestionIds: result.matchedIds,
      unknown: !result.found,
      provider,
    });
  } catch (err) {
    console.error("[ai-chat]", err);
    return NextResponse.json({ error: "Erro ao consultar a IA." }, { status: 500 });
  }
}
