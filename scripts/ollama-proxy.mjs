import http from "node:http";

const LISTEN_HOST = process.env.OLLAMA_PROXY_HOST ?? "127.0.0.1";
const LISTEN_PORT = Number(process.env.OLLAMA_PROXY_PORT ?? "11435");
const OLLAMA_ORIGIN = (process.env.OLLAMA_LOCAL_ORIGIN ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const TOKEN = process.env.OLLAMA_PROXY_TOKEN;
const TOKEN_HEADER = "x-embrepoli-ia-token";

if (!TOKEN) {
  console.error("OLLAMA_PROXY_TOKEN nao configurado.");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  if (req.headers[TOKEN_HEADER] !== TOKEN) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const target = new URL(req.url ?? "/", OLLAMA_ORIGIN);
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (!value || name.toLowerCase() === TOKEN_HEADER || name.toLowerCase() === "host") continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else {
      headers.set(name, value);
    }
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: "half",
    });

    res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    console.error("[ollama-proxy]", error);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "ollama_unavailable" }));
  }
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`Ollama proxy ouvindo em http://${LISTEN_HOST}:${LISTEN_PORT} -> ${OLLAMA_ORIGIN}`);
});
