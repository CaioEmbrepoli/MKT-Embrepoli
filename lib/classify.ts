// Classificação local de comentários — sem IA, sem custo, instantâneo.
// Retorna "duvida" ou "normal" para casos óbvios, "incerto" para o resto (vai para Gemini).

export type LocalClassification = "duvida" | "normal" | "incerto";

const INTERROGATIVE_STARTS = [
  "tem como",
  "da para",
  "da pra",
  "dá para",
  "dá pra",
  "por que",
  "e possivel",
  "é possível",
  "como",
  "quanto",
  "qual",
  "quando",
  "onde",
  "porque",
  "posso",
  "aceita",
  "suporta",
  "serve",
  "cabe",
  "precisa",
  "funciona",
  "existe",
  "ha ",
  "há ",
  "tem "
];

// Reações genéricas — quando o comentário inteiro é só isso + pontuação/emoji
const GENERIC_REACTIONS = new Set([
  "top",
  "otimo",
  "incrivel",
  "demais",
  "amei",
  "maravilhoso",
  "parabens",
  "perfeito",
  "show",
  "excelente",
  "boa",
  "legal",
  "lindo",
  "bonito",
  "sensacional",
  "fantástico",
  "fantastico",
  "muito bom",
  "muito boa",
  "que bom",
  "que legal",
  "que incrivel",
  "que lindo"
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyLocal(text: string): LocalClassification {
  const t = text.trim();
  if (!t) return "normal";

  // Sem nenhuma letra → só emojis/símbolos/números
  if (!/[a-zA-ZÀ-ú]/.test(t)) return "normal";

  // Muito curto (emojis com texto, "Top!", "👏👏", "ótimo!")
  if (t.length < 15) return "normal";

  // Menção ou hashtag isolado
  if (t.startsWith("@") || t.startsWith("#")) return "normal";

  // Tem ponto de interrogação → é uma dúvida
  if (t.includes("?")) return "duvida";

  const norm = normalize(t);

  // Começa com palavra/expressão interrogativa
  if (INTERROGATIVE_STARTS.some((w) => norm.startsWith(w))) return "duvida";

  // Reação genérica curta (até 4 palavras e bate na lista)
  const words = norm.split(" ");
  if (words.length <= 4 && GENERIC_REACTIONS.has(norm)) return "normal";
  // Checar multi-word reactions
  if (words.length <= 4 && words.some((w) => GENERIC_REACTIONS.has(w))) {
    // Só marca como "normal" se 80%+ das palavras são reação ou ruído
    const reactionWords = words.filter((w) => GENERIC_REACTIONS.has(w) || w.length <= 2);
    if (reactionWords.length / words.length >= 0.8) return "normal";
  }

  return "incerto";
}
