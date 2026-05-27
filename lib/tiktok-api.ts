import { supabase } from "./supabase";

async function getAuthHeaders(): Promise<HeadersInit> {
  if (!supabase) {
    throw new Error("Supabase nao configurado. A integracao TikTok precisa do Supabase.");
  }
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error("Sessao expirada. Entre novamente para usar a integracao TikTok.");
  }
  return { Authorization: `Bearer ${token}` };
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 25000): Promise<T> {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...headers,
        ...(init?.headers ?? {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error ?? "Erro na integracao TikTok.");
    }
    return data as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo limite excedido. Tente novamente.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export type TikTokConnectionStatus = {
  connected: boolean;
  environment: "sandbox" | "production";
  displayName: string;
  avatarUrl: string;
  openId: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
  canManage: boolean;
};

export type TikTokVideo = {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string;
  shareUrl: string;
  embedLink: string;
  createTime: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
};

export type TikTokProfile = {
  openId: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
};

export async function getTikTokStatus(): Promise<TikTokConnectionStatus> {
  return fetchJson<TikTokConnectionStatus>("/api/tiktok/status");
}

export async function startTikTokConnection(): Promise<string> {
  const data = await fetchJson<{ url: string }>("/api/tiktok/oauth/start");
  return data.url;
}

export async function disconnectTikTokConnection(): Promise<void> {
  await fetchJson<{ ok: true }>("/api/tiktok/disconnect", { method: "POST" });
}

export async function listTikTokVideos(): Promise<{ profile: TikTokProfile; videos: TikTokVideo[] }> {
  return fetchJson<{ profile: TikTokProfile; videos: TikTokVideo[] }>("/api/tiktok/videos", undefined, 45000);
}
