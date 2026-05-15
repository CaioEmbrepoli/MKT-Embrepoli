// Google Drive Picker and YouTube Data API v3 integration
// Config is fetched from /api/google-config (server-side vars, no NEXT_PUBLIC_ needed)

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

type GoogleConfig = { apiKey: string; clientId: string };

let configCache: GoogleConfig | null = null;

async function getConfig(): Promise<GoogleConfig> {
  if (configCache) return configCache;
  const res = await fetch("/api/google-config");
  if (!res.ok) throw new Error("Não foi possível carregar a configuração do Google.");
  configCache = await res.json();
  return configCache!;
}

// ─── OAuth Token Cache (localStorage) ────────────────────────────────────────
// Evita mostrar o seletor de conta Google a cada acesso ao Drive/YouTube.
// Tokens do Google expiram em ~1h; guardamos com 55min de validade por segurança.

const TOKEN_CACHE_KEY = "embrepoli_google_tokens";

type CachedToken = {
  token: string;
  scope: string;
  expiresAt: number; // timestamp ms
};

function readTokenCache(): CachedToken[] {
  try {
    const raw = localStorage.getItem(TOKEN_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedToken[]) : [];
  } catch {
    return [];
  }
}

function writeTokenCache(entries: CachedToken[]): void {
  try {
    localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // ignora erros de storage (janela privada, cota cheia, etc.)
  }
}

function getCachedToken(scope: string): string | null {
  const now = Date.now();
  const entry = readTokenCache().find(
    (c) => c.scope === scope && c.expiresAt > now + 60_000 // 1min de margem
  );
  return entry?.token ?? null;
}

function saveCachedToken(scope: string, token: string): void {
  const entries = readTokenCache().filter((c) => c.scope !== scope);
  entries.push({ token, scope, expiresAt: Date.now() + 55 * 60 * 1000 });
  writeTokenCache(entries);
}

/** Limpa todos os tokens salvos — útil para forçar nova autenticação */
export function clearGoogleTokenCache(): void {
  try {
    localStorage.removeItem(TOKEN_CACHE_KEY);
  } catch {
    // ignore
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}

let gapiReady = false;
async function ensureGapi(): Promise<void> {
  if (gapiReady) return;
  await loadScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve) => window.gapi.load("picker", resolve));
  gapiReady = true;
}

let gisReady = false;
async function ensureGis(): Promise<void> {
  if (gisReady) return;
  await loadScript("https://accounts.google.com/gsi/client");
  await new Promise<void>((resolve) => {
    if (window.google?.accounts) { resolve(); return; }
    const interval = setInterval(() => {
      if (window.google?.accounts) { clearInterval(interval); resolve(); }
    }, 50);
  });
  gisReady = true;
}

function requestAccessToken(
  clientId: string,
  scope: string,
  hint?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      // hint preenche o campo de email automaticamente na tela de consentimento
      ...(hint ? { login_hint: hint } : {}),
      callback: (response: { access_token?: string; error?: string }) => {
        if (response.access_token) {
          resolve(response.access_token);
        } else {
          reject(new Error(response.error ?? "Não foi possível autenticar com o Google."));
        }
      },
    });
    client.requestAccessToken();
  });
}

/** Email salvo da última autenticação Google bem-sucedida */
const HINT_KEY = "embrepoli_google_hint";

function getSavedHint(): string | undefined {
  try { return localStorage.getItem(HINT_KEY) ?? undefined; } catch { return undefined; }
}
function saveHint(email: string): void {
  try { localStorage.setItem(HINT_KEY, email); } catch { /* ignore */ }
}

async function getOAuthToken(scope: string): Promise<string> {
  // 1. Retorna token em cache se ainda válido
  const cached = getCachedToken(scope);
  if (cached) return cached;

  const { clientId } = await getConfig();
  if (!clientId) {
    throw new Error("Google Client ID não configurado. Verifique GOOGLE_CLIENT_ID na Vercel.");
  }
  await ensureGis();

  // 2. Passa o e-mail salvo como hint → Google pula a tela de seleção de conta
  const hint = getSavedHint();
  const token = await requestAccessToken(clientId, scope, hint);

  // 3. Persiste token e tenta salvar o e-mail para próximas sessões
  saveCachedToken(scope, token);
  // Tenta extrair o e-mail do token (tokeninfo endpoint) em background
  fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`)
    .then((r) => r.json())
    .then((info: { email?: string }) => { if (info.email) saveHint(info.email); })
    .catch(() => { /* não crítico */ });

  return token;
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  previewUrl: string;
  thumbnailUrl?: string;
};

export async function getDriveToken(): Promise<string> {
  return getOAuthToken("https://www.googleapis.com/auth/drive.readonly");
}

export async function getYouTubeReadToken(): Promise<string> {
  return getOAuthToken("https://www.googleapis.com/auth/youtube.readonly");
}

export async function getYouTubeUploadToken(): Promise<string> {
  return getOAuthToken("https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/drive.readonly");
}

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  size?: string;
  isFolder: boolean;
};

export async function listDriveFolder(folderId: string, token: string): Promise<DriveItem[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,thumbnailLink,modifiedTime,size)",
    orderBy: "folder,name",
    pageSize: "200",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Erro ao listar arquivos do Google Drive.");
  }
  const data = await res.json();
  return (data.files ?? []).map((file: any) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType ?? "",
    thumbnailLink: file.thumbnailLink,
    modifiedTime: file.modifiedTime,
    size: file.size,
    isFolder: file.mimeType === "application/vnd.google-apps.folder",
  }));
}

export type YouTubeVideo = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
  previewUrl: string;
};

export async function searchYouTube(query: string): Promise<YouTubeVideo[]> {
  const { apiKey } = await getConfig();
  if (!apiKey) {
    throw new Error("Chave da API do Google não configurada. Verifique GOOGLE_API_KEY na Vercel.");
  }
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "12",
    key: apiKey,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Erro ao buscar vídeos no YouTube.");
  }

  const data = await res.json();
  return (data.items ?? []).map((item: any) => {
    const videoId = item.id.videoId;
    return {
      videoId,
      title: item.snippet.title,
      thumbnail:
        item.snippet.thumbnails?.medium?.url ??
        item.snippet.thumbnails?.default?.url ??
        "",
      channelTitle: item.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      previewUrl: `https://www.youtube.com/embed/${videoId}`,
    };
  });
}

export type YouTubeChannelVideo = {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isShort: boolean;
};

export type YouTubeImportProgress =
  | { phase: "fetching-channel" }
  | { phase: "listing"; collected: number }
  | { phase: "stats"; done: number; total: number };

async function ytFetch(url: string, token: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Erro YouTube API (${res.status}).`);
  }
  return res.json();
}

async function getMyUploadsPlaylistId(token: string): Promise<string> {
  const data = await ytFetch(
    "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
    token
  );
  const uploads = data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) {
    throw new Error("Nenhum canal do YouTube encontrado nesta conta Google.");
  }
  return uploads;
}

async function listAllPlaylistVideoIds(
  playlistId: string,
  token: string,
  onProgress?: (collected: number) => void
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      part: "contentDetails",
      playlistId,
      maxResults: "50",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await ytFetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      token
    );
    for (const item of data.items ?? []) {
      const vid = item?.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    onProgress?.(ids.length);
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return ids;
}

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const seconds = parseInt(match[3] ?? "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

async function getVideosStats(
  videoIds: string[],
  token: string,
  onProgress?: (done: number, total: number) => void
): Promise<YouTubeChannelVideo[]> {
  const out: YouTubeChannelVideo[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "snippet,statistics,contentDetails",
      id: chunk.join(","),
      maxResults: "50",
    });
    const data = await ytFetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
      token
    );
    for (const item of data.items ?? []) {
      const snippet = item.snippet ?? {};
      const stats = item.statistics ?? {};
      const duration = item.contentDetails?.duration ?? "";
      const durationSec = parseDurationSeconds(duration);
      out.push({
        videoId: item.id,
        title: snippet.title ?? "",
        description: snippet.description ?? "",
        publishedAt: (snippet.publishedAt ?? "").slice(0, 10),
        thumbnail:
          snippet.thumbnails?.medium?.url ??
          snippet.thumbnails?.default?.url ??
          "",
        viewCount: parseInt(stats.viewCount ?? "0", 10) || 0,
        likeCount: parseInt(stats.likeCount ?? "0", 10) || 0,
        commentCount: parseInt(stats.commentCount ?? "0", 10) || 0,
        isShort: durationSec > 0 && durationSec <= 60,
      });
    }
    onProgress?.(Math.min(i + 50, videoIds.length), videoIds.length);
  }
  return out;
}

export async function listMyYouTubeChannelVideos(
  token: string,
  onProgress?: (p: YouTubeImportProgress) => void
): Promise<YouTubeChannelVideo[]> {
  onProgress?.({ phase: "fetching-channel" });
  const playlistId = await getMyUploadsPlaylistId(token);
  const ids = await listAllPlaylistVideoIds(playlistId, token, (collected) =>
    onProgress?.({ phase: "listing", collected })
  );
  if (ids.length === 0) return [];
  return getVideosStats(ids, token, (done, total) =>
    onProgress?.({ phase: "stats", done, total })
  );
}
