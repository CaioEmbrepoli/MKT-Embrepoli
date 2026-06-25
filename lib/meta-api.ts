import { supabase } from "./supabase";
import { errorFromResponse } from "./api-errors";

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
  const service = url.includes("/ads/") ? "meta_ads" : "instagram";
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
      errorFromResponse(data, {
        provider: service === "meta_ads" ? "meta_ads" : "instagram",
        service,
        error: service === "meta_ads" ? "Erro na integracao Meta Ads." : "Erro na integracao Instagram/Meta."
      });
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
  publishedAt?: string;
  externalReplies?: {
    id: string;
    authorName: string;
    authorAvatarUrl?: string;
    text: string;
    publishedAt?: string;
    likes?: number;
    isOwnReply?: boolean;
  }[];
  channelReply?: string;
  channelReplyExternalId?: string;
};

export type InstagramCommentImportSummary = {
  scope?: "recent" | "all";
  recentDays: number;
  since: string | null;
  maxMedia: number;
  maxCommentsPerMedia: number;
  mediaChecked: number;
  mediaWithComments: number;
  skippedWithoutComments: number;
  commentsMissingTimestamp?: number;
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

export async function listInstagramComments(scope: "recent" | "all" = "recent"): Promise<{ comments: InstagramCommentItem[]; mediaCount: number; summary?: InstagramCommentImportSummary }> {
  const query = scope === "all" ? "?scope=all" : "";
  return fetchJson<{ comments: InstagramCommentItem[]; mediaCount: number; summary?: InstagramCommentImportSummary }>(`/api/meta/instagram/comments${query}`, undefined, 120000);
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

export type MetaAdsImportRangeType = "last_30d" | "last_12m" | "all_time";

export async function enqueueMetaAdsImport(rangeType: MetaAdsImportRangeType): Promise<{ batchId: string; totalJobs: number }> {
  return fetchJson<{ batchId: string; totalJobs: number }>(
    "/api/meta/ads/import/enqueue",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rangeType }) },
    30000
  );
}

export type MetaAdsImportBatchStatus = {
  batchId: string | null;
  total: number;
  counts: { pending: number; processing: number; done: number; failed: number; canceled: number };
  done: boolean;
  aggregate: { accounts: number; campaigns: number; adSets: number; ads: number; insights: number };
  errors: string[];
};

export async function getMetaAdsImportBatchStatus(batchId: string): Promise<MetaAdsImportBatchStatus> {
  return fetchJson<MetaAdsImportBatchStatus>(`/api/meta/ads/import/status?batchId=${encodeURIComponent(batchId)}`, undefined, 15000);
}

// Sem batchId: devolve o ultimo lote de importacao da organizacao (ou
// batchId null se nunca rodou nenhum) — usado pelo indicador de progresso
// fora do modal e para retomar o acompanhamento ao reabrir o modal.
export async function getLatestMetaAdsImportBatchStatus(): Promise<MetaAdsImportBatchStatus> {
  return fetchJson<MetaAdsImportBatchStatus>("/api/meta/ads/import/status", undefined, 15000);
}
