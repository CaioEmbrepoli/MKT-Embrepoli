import { supabase } from "./supabase";

type GoogleConfig = { apiKey: string; clientId: string };

let configCache: GoogleConfig | null = null;

async function getConfig(): Promise<GoogleConfig> {
  if (configCache) return configCache;
  const res = await fetch("/api/google-config");
  if (!res.ok) throw new Error("Nao foi possivel carregar a configuracao do Google.");
  configCache = await res.json();
  return configCache!;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  if (!supabase) {
    throw new Error("Supabase nao configurado. A integracao Google corporativa precisa do Supabase.");
  }
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error("Sessao expirada. Entre novamente para usar a integracao Google.");
  }
  return { Authorization: `Bearer ${token}` };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers ?? {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? "Erro na integracao Google.");
  }
  return data as T;
}

export type GoogleService = "drive" | "youtube";

export type GoogleServiceConnectionStatus = {
  connected: boolean;
  googleEmail: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
};

export type GoogleConnectionStatus = {
  drive: GoogleServiceConnectionStatus;
  youtube: GoogleServiceConnectionStatus;
  canManage: boolean;
};

export async function getGoogleStatus(): Promise<GoogleConnectionStatus> {
  return fetchJson<GoogleConnectionStatus>("/api/google/status");
}

export async function startGoogleConnection(service: GoogleService): Promise<string> {
  const data = await fetchJson<{ url: string }>(`/api/google/oauth/start?service=${service}`);
  return data.url;
}

export async function disconnectGoogleConnection(service: GoogleService): Promise<void> {
  await fetchJson<{ ok: true }>("/api/google/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service })
  });
}

export function clearGoogleTokenCache(): void {
  try {
    localStorage.removeItem("embrepoli_google_tokens");
    localStorage.removeItem("embrepoli_google_hint");
  } catch {
    // ignore
  }
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  previewUrl: string;
  thumbnailUrl?: string;
};

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  size?: string;
  isFolder: boolean;
};

export async function getDriveToken(): Promise<string> {
  const status = await getGoogleStatus();
  if (!status.drive.connected) throw new Error("Google Drive nao conectado. Peca para um Gestor conectar a conta corporativa.");
  return "";
}

export async function getYouTubeReadToken(): Promise<string> {
  const status = await getGoogleStatus();
  if (!status.youtube.connected) throw new Error("YouTube nao conectado. Peca para um Gestor conectar a conta corporativa.");
  return "";
}

export async function getYouTubeUploadToken(): Promise<string> {
  throw new Error("Upload/publicacao no YouTube ainda nao usa a conexao corporativa.");
}

export async function listDriveFolder(folderId: string, _token?: string): Promise<DriveItem[]> {
  const params = new URLSearchParams({ folderId });
  const data = await fetchJson<{ files: DriveItem[] }>(`/api/google/drive/list?${params}`);
  return data.files;
}

export async function fetchDriveThumbnailObjectUrl(fileId: string): Promise<string> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/google/drive/thumb?fileId=${encodeURIComponent(fileId)}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? "Nao foi possivel carregar a miniatura do Drive.");
  }
  return URL.createObjectURL(await res.blob());
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
    throw new Error("Chave da API do Google nao configurada. Verifique GOOGLE_API_KEY na Vercel.");
  }
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "12",
    key: apiKey
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Erro ao buscar videos no YouTube.");
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
      previewUrl: `https://www.youtube.com/embed/${videoId}`
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
  privacyStatus: "public" | "unlisted" | "private";
};

export type YouTubeImportProgress =
  | { phase: "fetching-channel" }
  | { phase: "listing"; collected: number }
  | { phase: "stats"; done: number; total: number };

export async function listMyYouTubeChannelVideos(
  tokenOrProgress?: string | ((p: YouTubeImportProgress) => void),
  maybeProgress?: (p: YouTubeImportProgress) => void
): Promise<YouTubeChannelVideo[]> {
  const onProgress = typeof tokenOrProgress === "function" ? tokenOrProgress : maybeProgress;
  onProgress?.({ phase: "fetching-channel" });
  const data = await fetchJson<{ videos: YouTubeChannelVideo[] }>("/api/google/youtube/uploads");
  onProgress?.({ phase: "stats", done: data.videos.length, total: data.videos.length });
  return data.videos;
}
