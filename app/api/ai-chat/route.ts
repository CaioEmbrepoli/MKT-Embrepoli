import { NextRequest, NextResponse } from "next/server";
import { ollamaHeaders } from "@/lib/ollama-auth";

/**
 * POST /api/ai-chat
 *
 * Chat de duvidas com contexto do banco de perguntas.
 * Retorna { answer, matchedQuestionIds, unknown, provider }.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST?.replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

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
  if (!OLLAMA_HOST) throw new Error("OLLAMA_HOST nao configurado.");

  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: ollamaHeaders(),
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
    console.log(`[ai-chat] usando ollama (model: ${OLLAMA_MODEL})`);

    const text = await callOllama(prompt);
    const result = parseResult(text);

    return NextResponse.json({
      answer: result.answer,
      matchedQuestionIds: result.matchedIds,
      unknown: !result.found,
      provider: "ollama",
    });
  } catch (err) {
    console.error("[ai-chat]", err);
    return NextResponse.json({ error: "Erro ao consultar a IA local." }, { status: 500 });
  }
}
