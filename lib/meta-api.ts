import { supabase } from "./supabase";

async function getAuthHeaders(): Promise<HeadersInit> {
  if (!supabase) {
    throw new Error("Supabase nao configurado. A integracao Instagram/Meta precisa do Supabase.");
  }
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error("Sessao expirada. Entre novamente para usar a integracao Instagram/Meta.");
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
      throw new Error(data?.error ?? "Erro na integracao Instagram/Meta.");
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

export type InstagramConnectionStatus = {
  connected: boolean;
  service: "instagram";
  username: string;
  displayName: string;
  avatarUrl: string;
  instagramAccountId: string;
  pageId: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
  expiresAt: string;
  canManage: boolean;
};

export type InstagramMedia = {
  id: string;
  caption: string;
  mediaType: string;
  mediaUrl: string;
  thumbnailUrl: string;
  permalink: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
};

export type InstagramMetricItem = InstagramMedia & {
  reach: number;
  impressions: number;
  views: number;
  shares: number;
  saved: number;
  totalInteractions: number;
};

export type InstagramCommentItem = {
  commentId: string;
  videoId: string;
  videoTitle: string;
  mediaThumbnailUrl?: string;
  mediaUrl?: string;
  mediaPermalink?: string;
  authorName: string;
  text: string;
  likes: number;
  publishedAt: string;
  channelReply?: string;
};

export type InstagramCommentImportSummary = {
  recentDays: number;
  since: string;
  maxMedia: number;
  maxCommentsPerMedia: number;
  mediaChecked: number;
  mediaWithComments: number;
  skippedWithoutComments: number;
  commentsFound: number;
};

export type MetaAdsConnectionStatus = {
  connected: boolean;
  service: "ads";
  username: string;
  displayName: string;
  adAccountId: string;
  adAccountName: string;
  businessId: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
  expiresAt: string;
  canManage: boolean;
};

export type MetaAdsImportSummary = {
  accounts: number;
  campaigns: number;
  adSets: number;
  ads: number;
  insights: number;
  datePreset: string;
};

export async function getInstagramStatus(): Promise<InstagramConnectionStatus> {
  return fetchJson<InstagramConnectionStatus>("/api/meta/instagram/status");
}

export async function startInstagramOAuth(): Promise<void> {
  const data = await fetchJson<{ url: string }>("/api/meta/instagram/oauth/start");
  window.location.href = data.url;
}

export async function disconnectInstagramConnection(): Promise<void> {
  await fetchJson<{ ok: true }>("/api/meta/instagram/disconnect", { method: "POST" });
}

export async function listInstagramMedia(): Promise<{ media: InstagramMedia[] }> {
  return fetchJson<{ media: InstagramMedia[] }>("/api/meta/instagram/media", undefined, 90000);
}

export async function listInstagramComments(): Promise<{ comments: InstagramCommentItem[]; mediaCount: number; summary?: InstagramCommentImportSummary }> {
  return fetchJson<{ comments: InstagramCommentItem[]; mediaCount: number; summary?: InstagramCommentImportSummary }>("/api/meta/instagram/comments", undefined, 120000);
}

export async function listInstagramMetrics(): Promise<{ metrics: InstagramMetricItem[] }> {
  return fetchJson<{ metrics: InstagramMetricItem[] }>("/api/meta/instagram/metrics", undefined, 120000);
}

export async function getMetaAdsStatus(): Promise<MetaAdsConnectionStatus> {
  return fetchJson<MetaAdsConnectionStatus>("/api/meta/ads/status");
}

export async function startMetaAdsOAuth(): Promise<void> {
  const data = await fetchJson<{ url: string }>("/api/meta/ads/oauth/start");
  window.location.href = data.url;
}

export async function disconnectMetaAdsConnection(): Promise<void> {
  await fetchJson<{ ok: true }>("/api/meta/ads/disconnect", { method: "POST" });
}

export async function importMetaAdsData(): Promise<{ summary: MetaAdsImportSummary }> {
  return fetchJson<{ summary: MetaAdsImportSummary }>("/api/meta/ads/import", { method: "POST" }, 180000);
}
