import { NextRequest, NextResponse } from "next/server";
import { ollamaHeaders } from "@/lib/ollama-auth";

/**
 * POST /api/ai-classify
 *
 * Classificacao em batch de comentarios do YouTube usando Ollama.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST?.replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

export type ClassifyResult = {
  id: string;
  tipo: "duvida_relevante" | "normal";
  confidence: number;
  reason: string;
};

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
  return data.response?.trim() ?? "[]";
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

    const prompt = `Voce e um classificador de comentarios para a Embrepoli, empresa de kits turbo e intercooler para motores diesel.

Classifique cada comentario abaixo como:
- "duvida_relevante": pergunta real de cliente sobre produto, preco, disponibilidade, instalacao, compatibilidade, garantia, aplicacao, desempenho ou atendimento.
- "normal": elogio, reacao emocional, emoji, comentario off-topic, spam, frase curta sem duvida real ou comentario que nao ajude a montar uma base de perguntas.

Retorne somente um JSON array com esta estrutura exata, sem explicacoes:
[{"id":"...","tipo":"duvida_relevante ou normal","confidence":0.92,"reason":"motivo curto em portugues"},...]

Comentarios:
${commentList}`;

    console.log(`[ai-classify] usando ollama (model: ${OLLAMA_MODEL})`);
    const text = await callOllama(prompt);

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

    return NextResponse.json({ results, provider: "ollama" });
  } catch (err) {
    console.error("[ai-classify]", err);
    return NextResponse.json({ error: "Erro ao classificar comentarios com IA local." }, { status: 500 });
  }
}
