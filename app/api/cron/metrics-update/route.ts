import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { exchangeRefreshToken } from "@/lib/google-server";
import { fetchInstagramInsightsForMedia, fetchInstagramMedia, type InstagramMetricItem, type MetaRequestContext } from "@/lib/meta-server";
import { importMetaAdsData } from "@/lib/meta-ads-server";
import { fetchTikTokUserInfo, getTikTokAccessToken, tiktokEnvironment, type TikTokRequestContext } from "@/lib/tiktok-server";
import { recordDiagnostic, type ApiErrorProvider } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type MetricRow = Record<string, any>;

type OrganicUpsertSummary = {
  posts: number;
  created: number;
  updated: number;
  snapshots: number;
};

type CronChannelResult = {
  ok: boolean;
  orgId?: string;
  connectionId?: string;
  label?: string;
  error?: string | null;
} & Record<string, unknown>;

const TIKTOK_VIDEO_FIELDS = [
  "id",
  "title",
  "video_description",
  "duration",
  "cover_image_url",
  "embed_link",
  "share_url",
  "create_time",
  "view_count",
  "like_count",
  "comment_count",
  "share_count"
].join(",");

async function ytFetch(url: string, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? `Erro YouTube API (${response.status}).`);
  return data;
}

async function ytAnalyticsFetch(url: string, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message ?? `Erro YouTube Analytics API (${response.status}).`);
  return data;
}

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dateFromTimestamp(value: unknown, fallback = todayIso()) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 10);
}

function maybeText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function truncateText(value: string, max = 140) {
  const chars = [...value.trim()];
  return chars.length > max ? `${chars.slice(0, max).join("")}...` : chars.join("");
}

function isMetricChanged(existing: MetricRow, next: MetricRow) {
  return (
    Number(existing.reach ?? 0) !== Number(next.reach ?? 0) ||
    Number(existing.likes ?? 0) !== Number(next.likes ?? 0) ||
    Number(existing.comments ?? 0) !== Number(next.comments ?? 0) ||
    Number(existing.shares ?? 0) !== Number(next.shares ?? 0)
  );
}

function keepExistingWhenMissing<T>(existingValue: T | null | undefined, nextValue: T | null | undefined) {
  return nextValue == null ? (existingValue ?? null) : nextValue;
}

async function resolveChannelId(client: SupabaseClient, organizationId: string, key: "youtube" | "instagram" | "tiktok") {
  const candidates: Record<typeof key, string[]> = {
    youtube: ["youtube", "you tube"],
    instagram: ["instagram", "meta"],
    tiktok: ["tiktok", "tik tok"]
  };
  const { data } = await client
    .from("channels")
    .select("id, name")
    .eq("organization_id", organizationId);
  const rows = data ?? [];
  const byId = rows.find((row: any) => String(row.id).toLowerCase() === key);
  if (byId?.id) return String(byId.id);
  const found = rows.find((row: any) => {
    const name = String(row.name ?? "").toLowerCase();
    return candidates[key].some((candidate) => name.includes(candidate));
  });
  return found?.id ? String(found.id) : key;
}

async function upsertOrganicMetrics(
  client: SupabaseClient,
  organizationId: string,
  rows: MetricRow[]
): Promise<OrganicUpsertSummary> {
  if (!rows.length) return { posts: 0, created: 0, updated: 0, snapshots: 0 };

  const externalIds = rows.map((row) => String(row.external_id ?? "")).filter(Boolean);
  const { data: existingRows, error: existingError } = await client
    .from("post_metrics")
    .select("*")
    .eq("organization_id", organizationId)
    .in("external_id", externalIds);
  if (existingError) throw existingError;

  const existingByExternalId = new Map<string, MetricRow>();
  for (const row of existingRows ?? []) {
    if (row.external_id) existingByExternalId.set(String(row.external_id), row);
  }

  const capturedAt = new Date().toISOString();
  const snapshots: MetricRow[] = [];
  const payload: MetricRow[] = rows.map((row) => {
    const existing = existingByExternalId.get(String(row.external_id));
    const next = {
      ...row,
      id: existing?.id ?? row.id ?? crypto.randomUUID(),
      organization_id: organizationId,
      post_id: existing?.post_id ?? row.post_id ?? null,
      campaign_id: existing?.campaign_id ?? row.campaign_id ?? null,
      product_line_id: existing?.product_line_id ?? row.product_line_id ?? null,
      vehicle_type_id: existing?.vehicle_type_id ?? row.vehicle_type_id ?? null,
      content_type_id: existing?.content_type_id ?? row.content_type_id ?? null,
      funnel_stage_id: existing?.funnel_stage_id ?? row.funnel_stage_id ?? null,
      clicks: existing?.clicks ?? row.clicks ?? 0,
      leads: existing?.leads ?? row.leads ?? 0,
      notes: existing?.notes ?? row.notes ?? "",
      learning: existing?.learning ?? row.learning ?? "",
      watch_time_minutes: keepExistingWhenMissing(existing?.watch_time_minutes, row.watch_time_minutes),
      average_view_duration_seconds: keepExistingWhenMissing(existing?.average_view_duration_seconds, row.average_view_duration_seconds),
      average_view_percentage: keepExistingWhenMissing(existing?.average_view_percentage, row.average_view_percentage),
      subscribers_gained: keepExistingWhenMissing(existing?.subscribers_gained, row.subscribers_gained),
      subscribers_lost: keepExistingWhenMissing(existing?.subscribers_lost, row.subscribers_lost),
      impressions: keepExistingWhenMissing(existing?.impressions, row.impressions),
      impression_click_through_rate: keepExistingWhenMissing(existing?.impression_click_through_rate, row.impression_click_through_rate),
      thumbnail_url: keepExistingWhenMissing(existing?.thumbnail_url, row.thumbnail_url),
      source_url: keepExistingWhenMissing(existing?.source_url, row.source_url),
      embed_url: keepExistingWhenMissing(existing?.embed_url, row.embed_url)
    };

    if (existing && isMetricChanged(existing, next)) {
      snapshots.push({
        id: crypto.randomUUID(),
        organization_id: organizationId,
        metric_id: existing.id,
        captured_at: capturedAt,
        reach: existing.reach ?? 0,
        likes: existing.likes ?? 0,
        comments: existing.comments ?? 0,
        shares: existing.shares ?? 0,
        clicks: existing.clicks ?? 0,
        leads: existing.leads ?? 0
      });
    }

    return next;
  });

  if (snapshots.length) {
    const { error } = await client.from("post_metric_snapshots").insert(snapshots);
    if (error) throw error;
  }

  for (let i = 0; i < payload.length; i += 50) {
    const { error } = await client
      .from("post_metrics")
      .upsert(payload.slice(i, i + 50), { onConflict: "external_id" });
    if (error) throw error;
  }

  return {
    posts: rows.length,
    created: payload.filter((row) => !existingByExternalId.has(String(row.external_id))).length,
    updated: payload.filter((row) => existingByExternalId.has(String(row.external_id))).length,
    snapshots: snapshots.length
  };
}

type VideoAnalytics = {
  watchTimeMinutes?: number;
  averageViewDurationSeconds?: number;
  averageViewPercentage?: number;
  subscribersGained?: number;
  subscribersLost?: number;
  impressions?: number;
  impressionClickThroughRate?: number;
};

function mergeAnalyticsRows(map: Map<string, VideoAnalytics>, data: any, fields: Record<string, keyof VideoAnalytics>) {
  const headers: string[] = (data?.columnHeaders ?? []).map((header: any) => String(header.name));
  const videoIndex = headers.indexOf("video");
  if (videoIndex < 0) return;
  for (const row of data?.rows ?? []) {
    const videoId = String(row[videoIndex] ?? "");
    if (!videoId) continue;
    const current = map.get(videoId) ?? {};
    headers.forEach((name, index) => {
      const field = fields[name];
      if (!field) return;
      const raw = Number(row[index]);
      if (Number.isFinite(raw)) current[field] = raw;
    });
    map.set(videoId, current);
  }
}

async function fetchYouTubeAnalyticsByVideo(videoIds: string[], accessToken: string) {
  const analytics = new Map<string, VideoAnalytics>();
  const endDate = todayIso();
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    if (!chunk.length) continue;
    const base = {
      ids: "channel==MINE",
      startDate: "2005-02-14",
      endDate,
      dimensions: "video",
      filters: `video==${chunk.join(",")}`,
      maxResults: "50"
    };
    const core = await ytAnalyticsFetch(`https://youtubeanalytics.googleapis.com/v2/reports?${new URLSearchParams({
      ...base,
      metrics: "estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost"
    })}`, accessToken);
    mergeAnalyticsRows(analytics, core, {
      estimatedMinutesWatched: "watchTimeMinutes",
      averageViewDuration: "averageViewDurationSeconds",
      averageViewPercentage: "averageViewPercentage",
      subscribersGained: "subscribersGained",
      subscribersLost: "subscribersLost"
    });
    try {
      const discovery = await ytAnalyticsFetch(`https://youtubeanalytics.googleapis.com/v2/reports?${new URLSearchParams({
        ...base,
        metrics: "impressions,impressionClickThroughRate"
      })}`, accessToken);
      mergeAnalyticsRows(analytics, discovery, {
        impressions: "impressions",
        impressionClickThroughRate: "impressionClickThroughRate"
      });
    } catch {
      // Nem todo canal libera impressoes por video.
    }
  }
  return analytics;
}

async function fetchYouTubeVideos(accessToken: string) {
  const channelData = await ytFetch(
    "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
    accessToken
  );
  const playlistId = channelData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error("Nenhum canal do YouTube encontrado.");

  const ids: string[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ part: "contentDetails", playlistId, maxResults: "50" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await ytFetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, accessToken);
    for (const item of page.items ?? []) {
      if (item?.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);

  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "snippet,statistics,contentDetails,status",
      id: chunk.join(","),
      maxResults: "50"
    });
    const data = await ytFetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, accessToken);
    for (const item of data.items ?? []) {
      const snippet = item.snippet ?? {};
      const stats = item.statistics ?? {};
      const durationSec = parseDurationSeconds(item.contentDetails?.duration ?? "");
      videos.push({
        videoId: item.id as string,
        title: (snippet.title ?? "") as string,
        publishedAt: ((snippet.publishedAt ?? "") as string).slice(0, 10),
        viewCount: parseInt(stats.viewCount ?? "0", 10) || 0,
        likeCount: parseInt(stats.likeCount ?? "0", 10) || 0,
        commentCount: parseInt(stats.commentCount ?? "0", 10) || 0,
        isShort: durationSec > 0 && durationSec <= 60,
        privacyStatus: (item.status?.privacyStatus ?? "public") as "public" | "unlisted" | "private"
      });
    }
  }
  const analytics = await fetchYouTubeAnalyticsByVideo(ids, accessToken).catch(() => new Map<string, VideoAnalytics>());
  return videos.map((video) => ({ ...video, ...(analytics.get(video.videoId) ?? {}) }));
}

async function runYouTube(client: SupabaseClient): Promise<CronChannelResult[]> {
  const { data: connections, error } = await client
    .from("google_connections")
    .select("*")
    .eq("service", "youtube");
  if (error) throw error;
  if (!connections?.length) return [{ ok: true, label: "youtube", skipped: true, reason: "Nenhuma conexao YouTube ativa." }];

  const results: CronChannelResult[] = [];
  for (const conn of connections) {
    try {
      let accessToken: string = conn.access_token ?? "";
      const expiresAt = new Date(conn.expires_at || 0).getTime();
      if (!accessToken || expiresAt <= Date.now() + 60_000) {
        const refreshed = await exchangeRefreshToken(conn.refresh_token);
        accessToken = refreshed.accessToken;
        await client.from("google_connections").update({
          access_token: refreshed.accessToken,
          expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString()
        }).eq("id", conn.id);
      }

      const videos = await fetchYouTubeVideos(accessToken);
      const channelId = await resolveChannelId(client, conn.organization_id, "youtube");
      const { data: posts } = await client
        .from("posts")
        .select("id, published_video_id")
        .eq("organization_id", conn.organization_id);
      const postByVideoId = new Map(
        (posts ?? []).filter((post: any) => post.published_video_id).map((post: any) => [String(post.published_video_id), post])
      );

      const rows = videos.map((video) => {
        const linkedPost = postByVideoId.get(video.videoId);
        return {
          id: crypto.randomUUID(),
          organization_id: conn.organization_id,
          external_id: `yt:${video.videoId}`,
          post_id: linkedPost?.id ?? null,
          post_title: video.title || "Video YouTube",
          channel_id: channelId,
          metric_date: video.publishedAt || todayIso(),
          reach: video.viewCount,
          likes: video.likeCount,
          comments: video.commentCount,
          shares: 0,
          clicks: 0,
          leads: 0,
          notes: "",
          learning: "",
          video_type: video.isShort ? "short" : "video",
          privacy_status: video.privacyStatus,
          watch_time_minutes: video.watchTimeMinutes ?? null,
          average_view_duration_seconds: video.averageViewDurationSeconds ?? null,
          average_view_percentage: video.averageViewPercentage ?? null,
          subscribers_gained: video.subscribersGained ?? null,
          subscribers_lost: video.subscribersLost ?? null,
          impressions: video.impressions ?? null,
          impression_click_through_rate: video.impressionClickThroughRate ?? null
        };
      });
      const summary = await upsertOrganicMetrics(client, conn.organization_id, rows);
      results.push({ ok: true, orgId: conn.organization_id, connectionId: conn.id, label: conn.google_email, ...summary });
    } catch (err) {
      results.push({
        ok: false,
        orgId: conn.organization_id,
        connectionId: conn.id,
        label: conn.google_email,
        error: err instanceof Error ? err.message : "Erro desconhecido no YouTube."
      });
    }
  }
  return results;
}

async function runInstagram(client: SupabaseClient): Promise<CronChannelResult[]> {
  const { data: connections, error } = await client
    .from("meta_connections")
    .select("*")
    .eq("service", "instagram");
  if (error) throw error;
  if (!connections?.length) return [{ ok: true, label: "instagram", skipped: true, reason: "Nenhuma conexao Instagram ativa." }];

  const results: CronChannelResult[] = [];
  for (const conn of connections) {
    try {
      if (!conn.access_token || !conn.instagram_account_id) throw new Error("Instagram sem token ou conta vinculada.");
      if (conn.expires_at && new Date(conn.expires_at).getTime() < Date.now()) {
        throw new Error("Token do Instagram expirado. Reconecte ou aguarde o cron de refresh.");
      }
      const media = await fetchInstagramMedia(conn.access_token, conn.instagram_account_id);

      // Busca insights só para posts dos últimos 90 dias — evita timeout no cron
      // Posts antigos têm métricas estáveis; o reach já foi capturado na primeira importação
      const insightsCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const insightsMap = new Map<string, Awaited<ReturnType<typeof fetchInstagramInsightsForMedia>>>();
      const recentMedia = media.filter((item) => {
        const d = item.timestamp ? new Date(String(item.timestamp)) : null;
        return !d || d >= insightsCutoff;
      });
      // Processa em lotes de 10 para não sobrecarregar a API da Meta
      for (let i = 0; i < recentMedia.length; i += 10) {
        const batch = recentMedia.slice(i, i + 10);
        await Promise.all(batch.map(async (item) => {
          insightsMap.set(item.id, await fetchInstagramInsightsForMedia(conn.access_token, item));
        }));
      }

      const metrics: InstagramMetricItem[] = recentMedia.map((item) => ({
        ...item,
        ...(insightsMap.get(item.id) ?? { reach: 0, impressions: 0, views: 0, shares: 0, saved: 0, totalInteractions: 0 })
      }));
      const channelId = await resolveChannelId(client, conn.organization_id, "instagram");
      const rows = metrics.map((item) => {
        const caption = truncateText(item.caption || "Post Instagram");
        const reach = item.reach || item.impressions || item.views || 0;
        return {
          id: crypto.randomUUID(),
          organization_id: conn.organization_id,
          external_id: `instagram:${item.id}`,
          post_title: caption || "Post Instagram",
          channel_id: channelId,
          metric_date: dateFromTimestamp(item.timestamp),
          reach,
          likes: item.likeCount,
          comments: item.commentsCount,
          shares: item.shares,
          clicks: 0,
          leads: 0,
          notes: "Importado do Instagram / Meta.",
          learning: "",
          video_type: item.mediaType?.toLowerCase().includes("video") || item.mediaType?.toLowerCase().includes("reel") ? "short" : null,
          privacy_status: "public",
          impressions: item.impressions || null,
          thumbnail_url: maybeText(item.thumbnailUrl) ?? maybeText(item.mediaUrl),
          source_url: maybeText(item.permalink),
          embed_url: maybeText(item.permalink)
        };
      });
      const summary = await upsertOrganicMetrics(client, conn.organization_id, rows);
      results.push({ ok: true, orgId: conn.organization_id, connectionId: conn.id, label: conn.username, ...summary });
    } catch (err) {
      results.push({
        ok: false,
        orgId: conn.organization_id,
        connectionId: conn.id,
        label: conn.username,
        error: err instanceof Error ? err.message : "Erro desconhecido no Instagram."
      });
    }
  }
  return results;
}

function normalizeTikTokVideo(item: any) {
  return {
    id: String(item.id || ""),
    title: String(item.title || item.video_description || "Video TikTok"),
    description: String(item.video_description || item.title || ""),
    coverImageUrl: String(item.cover_image_url || ""),
    shareUrl: String(item.share_url || ""),
    embedLink: String(item.embed_link || ""),
    createTime: Number(item.create_time || 0),
    viewCount: Number(item.view_count || 0),
    likeCount: Number(item.like_count || 0),
    commentCount: Number(item.comment_count || 0),
    shareCount: Number(item.share_count || 0)
  };
}

async function fetchTikTokVideos(accessToken: string) {
  const videos: any[] = [];
  let cursor: number | undefined;
  let hasMore = true;
  let pagesFetched = 0;
  let stoppedByLimit = false;
  const seenCursors = new Set<number>();

  while (hasMore && pagesFetched < 500 && videos.length < 10000) {
    const response = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(TIKTOK_VIDEO_FIELDS)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        max_count: 20,
        ...(cursor != null ? { cursor } : {})
      })
    });
    const data = await response.json();
    if (!response.ok || (data?.error?.code && data.error.code !== "ok")) {
      throw new Error(data?.error?.message || data?.error?.code || "Nao foi possivel listar videos do TikTok.");
    }
    videos.push(...(data?.data?.videos ?? []));
    pagesFetched += 1;
    hasMore = Boolean(data?.data?.has_more);
    const nextCursor = data?.data?.cursor;
    if (nextCursor == null) {
      hasMore = false;
    } else if (seenCursors.has(Number(nextCursor))) {
      stoppedByLimit = true;
      hasMore = false;
    } else {
      cursor = Number(nextCursor);
      seenCursors.add(cursor);
    }
  }

  if (hasMore && (pagesFetched >= 500 || videos.length >= 10000)) stoppedByLimit = true;
  return {
    videos: videos.map(normalizeTikTokVideo).filter((item) => item.id),
    importSummary: { totalFetched: videos.length, pagesFetched, hasMore, stoppedByLimit }
  };
}

async function runTikTok(client: SupabaseClient): Promise<CronChannelResult[]> {
  const environment = tiktokEnvironment();
  const { data: connections, error } = await client
    .from("tiktok_connections")
    .select("*")
    .eq("environment", environment);
  if (error) throw error;
  if (!connections?.length) return [{ ok: true, label: "tiktok", skipped: true, reason: `Nenhuma conexao TikTok ${environment} ativa.` }];

  const results: CronChannelResult[] = [];
  for (const conn of connections) {
    try {
      const context: TikTokRequestContext = {
        userId: conn.connected_by || "cron",
        organizationId: conn.organization_id,
        role: "admin",
        active: true,
        service: client
      };
      const accessToken = await getTikTokAccessToken(context);
      const [profile, videoResult] = await Promise.all([
        fetchTikTokUserInfo(accessToken).catch(() => null),
        fetchTikTokVideos(accessToken)
      ]);
      const channelId = await resolveChannelId(client, conn.organization_id, "tiktok");
      const rows = videoResult.videos.map((video) => ({
        id: crypto.randomUUID(),
        organization_id: conn.organization_id,
        external_id: `tiktok:${video.id}`,
        post_title: video.title || video.description || "Video TikTok",
        channel_id: channelId,
        metric_date: video.createTime ? new Date(video.createTime * 1000).toISOString().slice(0, 10) : todayIso(),
        reach: video.viewCount,
        likes: video.likeCount,
        comments: video.commentCount,
        shares: video.shareCount,
        clicks: 0,
        leads: 0,
        notes: "Importado do TikTok.",
        learning: "",
        video_type: "video",
        privacy_status: "public",
        thumbnail_url: maybeText(video.coverImageUrl),
        source_url: maybeText(video.shareUrl),
        embed_url: maybeText(video.embedLink)
      }));
      const summary = await upsertOrganicMetrics(client, conn.organization_id, rows);
      results.push({
        ok: true,
        orgId: conn.organization_id,
        connectionId: conn.id,
        label: conn.display_name,
        profile: profile ? { displayName: profile.display_name, videoCount: Number(profile.video_count || 0) } : null,
        importSummary: videoResult.importSummary,
        ...summary
      });
    } catch (err) {
      results.push({
        ok: false,
        orgId: conn.organization_id,
        connectionId: conn.id,
        label: conn.display_name,
        error: err instanceof Error ? err.message : "Erro desconhecido no TikTok."
      });
    }
  }
  return results;
}

async function runMetaAds(client: SupabaseClient): Promise<CronChannelResult[]> {
  const { data: connections, error } = await client
    .from("meta_connections")
    .select("*")
    .eq("service", "ads");
  if (error) throw error;
  if (!connections?.length) return [{ ok: true, label: "metaAds", skipped: true, reason: "Nenhuma conexao Meta Ads ativa." }];

  const results: CronChannelResult[] = [];
  for (const conn of connections) {
    try {
      const context: MetaRequestContext = {
        userId: conn.connected_by || "cron",
        organizationId: conn.organization_id,
        role: "admin",
        active: true,
        service: client
      };
      const summary = await importMetaAdsData(context);
      results.push({
        ok: true,
        orgId: conn.organization_id,
        connectionId: conn.id,
        label: conn.ad_account_name || conn.username || conn.ad_account_id,
        ...summary
      });
    } catch (err) {
      results.push({
        ok: false,
        orgId: conn.organization_id,
        connectionId: conn.id,
        label: conn.ad_account_name || conn.username || conn.ad_account_id,
        error: err instanceof Error ? err.message : "Erro desconhecido no Meta Ads."
      });
    }
  }
  return results;
}

function summarize(results: Record<string, CronChannelResult[]>) {
  const summary: Record<string, { ok: number; failed: number; skipped: number; processed: number }> = {};
  for (const [key, items] of Object.entries(results)) {
    summary[key] = {
      ok: items.filter((item) => item.ok && !item.skipped).length,
      failed: items.filter((item) => !item.ok).length,
      skipped: items.filter((item) => item.skipped).length,
      processed: items.length
    };
  }
  return summary;
}

const PLATFORM_RUNNERS = {
  youtube: runYouTube,
  instagram: runInstagram,
  tiktok: runTikTok,
  metaads: runMetaAds,
} as const;

type PlatformKey = keyof typeof PLATFORM_RUNNERS;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}` && !isVercelCron) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase service role nao configurado." }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const executedAt = new Date().toISOString();

  // ?platform=instagram  →  roda só aquela plataforma.
  // Chamada sem plataforma ficava pesada e podia conflitar com os crons individuais.
  const { searchParams } = new URL(request.url);
  const platformParam = searchParams.get("platform")?.toLowerCase() as PlatformKey | null;
  if (!platformParam || !PLATFORM_RUNNERS[platformParam]) {
    return NextResponse.json({
      ok: false,
      executedAt,
      error: "Parametro platform obrigatorio. Use youtube, instagram, tiktok ou metaads."
    }, { status: 400 });
  }

  const platforms: PlatformKey[] = [platformParam];

  const results: Record<string, CronChannelResult[]> = {};
  for (const key of platforms) {
    try {
      results[key] = await PLATFORM_RUNNERS[key](adminClient);
    } catch (err) {
      results[key] = [{
        ok: false,
        label: key,
        error: err instanceof Error ? err.message : `Erro desconhecido em ${key}.`
      }];
    }
  }

  const providers: Record<PlatformKey, ApiErrorProvider> = {
    youtube: "youtube",
    instagram: "instagram",
    tiktok: "tiktok",
    metaads: "meta_ads"
  };
  await Promise.all(Object.entries(results).flatMap(([platform, rows]) => rows
    .filter((row) => !row.ok && row.orgId)
    .map((row) => recordDiagnostic(adminClient, {
      organizationId: String(row.orgId),
      provider: providers[platform as PlatformKey],
      service: platform === "metaads" ? "meta_ads" : platform,
      error: row.error ?? `Falha no cron de métricas ${platform}.`,
      category: "metricas",
      severity: "erro",
      eventKey: `metricas:${platform}:${row.connectionId ?? row.orgId}`,
      title: `Falha ao atualizar métricas do ${platform === "metaads" ? "Meta Ads" : platform}`,
      targetKind: "cron",
      targetId: platform,
      metadata: { connectionId: row.connectionId ?? null }
    }).catch(() => undefined))));

  return NextResponse.json({
    ok: Object.values(results).flat().every((item) => item.ok),
    executedAt,
    platform: platformParam ?? "all",
    summary: summarize(results),
    results
  });
}

export const POST = GET;
