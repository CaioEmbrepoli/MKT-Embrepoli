import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/gemini-classify
 *
 * Classificação em batch de comentários do YouTube.
 * Usa Ollama se OLLAMA_HOST estiver configurado, senão usa Gemini.
 *
 * Variáveis de ambiente:
 *   OLLAMA_HOST  = URL do Ollama (ex: https://seu-tunel.trycloudflare.com)
 *   OLLAMA_MODEL = modelo a usar (padrão: llama3.2)
 *   GEMINI_API_KEY = chave do Gemini (fallback)
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST?.replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

export type ClassifyResult = {
  id: string;
  tipo: "duvida_relevante" | "normal";
  confidence: number;
  reason: string;
};

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
  return data.response?.trim() ?? "[]";
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

export async function POST(req: NextRequest) {
  try {
    const { comments } = await req.json() as {
      comments: Array<{ id: string; text: string }>;
    };

    if (!comments?.length) {
      return NextResponse.json({ results: [] });
    }

    const commentList = comments
      .map((c, i) => `${i + 1}. [id:${c.id}] ${c.text}`)
      .join("\n");

    const prompt = `Você é um classificador de comentários para a Embrepoli, empresa de kits turbo e intercooler para motores diesel.

Classifique cada comentário abaixo como:
- "duvida_relevante": pergunta real de cliente sobre produto, preço, disponibilidade, instalação, compatibilidade, garantia, aplicação, desempenho ou atendimento.
- "normal": elogio, reação emocional, emoji, comentário off-topic, spam, frase curta sem dúvida real ou comentário que não ajude a montar uma base de perguntas.

Retorne somente um JSON array com esta estrutura exata, sem explicações:
[{"id":"...","tipo":"duvida_relevante ou normal","confidence":0.92,"reason":"motivo curto em português"},...]

Comentários:
${commentList}`;

    const provider = OLLAMA_HOST ? "ollama" : "gemini";
    console.log(`[ai-classify] usando ${provider} (model: ${OLLAMA_HOST ? OLLAMA_MODEL : "gemini-2.0-flash"})`);

    const text = OLLAMA_HOST ? await callOllama(prompt) : await callGemini(prompt);

    let parsed: Array<{ id?: unknown; tipo?: string; confidence?: unknown; reason?: unknown }> = [];
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("[ai-classify] falha ao parsear JSON:", text.slice(0, 200));
    }

    const results: ClassifyResult[] = parsed
      .map((item) => ({
        id: String(item.id ?? ""),
        tipo: (item.tipo === "duvida_relevante" || item.tipo === "duvida") ? "duvida_relevante" as const : "normal" as const,
        confidence: typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : 0.7,
        reason: String(item.reason ?? ""),
      }))
      .filter((item) => item.id);

    return NextResponse.json({ results, provider });
  } catch (err) {
    console.error("[ai-classify]", err);
    return NextResponse.json({ error: "Erro ao classificar comentários." }, { status: 500 });
  }
}
