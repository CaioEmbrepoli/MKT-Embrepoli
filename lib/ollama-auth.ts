export function ollamaHeaders(): HeadersInit {
  const token = process.env.OLLAMA_PROXY_TOKEN;

  if (!token) {
    throw new Error("OLLAMA_PROXY_TOKEN nao configurado.");
  }

  return {
    "Content-Type": "application/json",
    "X-Embrepoli-IA-Token": token,
  };
}
