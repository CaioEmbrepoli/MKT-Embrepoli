import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exchangeRefreshToken } from "@/lib/google-server";

export const dynamic = "force-dynamic";

async function ytFetch(url: string, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? `Erro YouTube API (${response.status}).`);
  return data;
}

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
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
  return videos;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
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

  const { data: connections, error: connError } = await adminClient
    .from("google_connections")
    .select("*")
    .eq("service", "youtube");

  if (connError) return NextResponse.json({ error: connError.message }, { status: 500 });
  if (!connections?.length) return NextResponse.json({ ok: true, results: [], message: "Nenhuma conexao YouTube ativa." });

  const results = [];

  for (const conn of connections) {
    try {
      // Renovar access token se necessário
      let accessToken: string = conn.access_token ?? "";
      const expiresAt = new Date(conn.expires_at || 0).getTime();
      if (!accessToken || expiresAt <= Date.now() + 60_000) {
        const refreshed = await exchangeRefreshToken(conn.refresh_token);
        accessToken = refreshed.accessToken;
        await adminClient.from("google_connections").update({
          access_token: refreshed.accessToken,
          expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString()
        }).eq("id", conn.id);
      }

      const videos = await fetchYouTubeVideos(accessToken);

      // Carregar métricas e posts existentes da org
      const [{ data: existingMetrics }, { data: posts }] = await Promise.all([
        adminClient.from("post_metrics").select("*").eq("organization_id", conn.organization_id),
        adminClient.from("posts").select("id, published_video_id").eq("organization_id", conn.organization_id)
      ]);

      const byExt = new Map((existingMetrics ?? []).filter(m => m.external_id).map(m => [m.external_id as string, m]));
      const byPostId = new Map(
        (existingMetrics ?? []).filter(m => !m.external_id && m.post_id).map(m => [m.post_id as string, m])
      );
      const postByVideoId = new Map(
        (posts ?? []).filter(p => p.published_video_id).map(p => [p.published_video_id as string, p])
      );

      const capturedAt = new Date().toISOString();
      const snapshots: Record<string, unknown>[] = [];
      const upsertRows: Record<string, unknown>[] = [];

      for (const v of videos) {
        const externalId = `yt:${v.videoId}`;
        const linkedPost = postByVideoId.get(v.videoId);
        const existing = byExt.get(externalId) ?? (linkedPost ? byPostId.get(linkedPost.id) : undefined);

        // Snapshot dos valores ANTIGOS (só se houve mudança)
        if (
          existing &&
          (existing.reach !== v.viewCount || existing.likes !== v.likeCount || existing.comments !== v.commentCount)
        ) {
          snapshots.push({
            id: crypto.randomUUID(),
            organization_id: conn.organization_id,
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

        upsertRows.push({
          id: existing?.id ?? crypto.randomUUID(),
          organization_id: conn.organization_id,
          external_id: externalId,
          post_id: linkedPost?.id ?? existing?.post_id ?? null,
          post_title: v.title,
          metric_date: v.publishedAt,
          reach: v.viewCount,
          likes: v.likeCount,
          comments: v.commentCount,
          shares: existing?.shares ?? 0,
          clicks: existing?.clicks ?? 0,
          leads: existing?.leads ?? 0,
          notes: existing?.notes ?? "",
          learning: existing?.learning ?? "",
          video_type: v.isShort ? "short" : "video",
          privacy_status: v.privacyStatus,
          channel_id: existing?.channel_id ?? null,
          campaign_id: existing?.campaign_id ?? null,
          product_line_id: existing?.product_line_id ?? null,
          vehicle_type_id: existing?.vehicle_type_id ?? null,
          content_type_id: existing?.content_type_id ?? null,
          funnel_stage_id: existing?.funnel_stage_id ?? null
        });
      }

      // Inserir snapshots em batch
      if (snapshots.length) {
        const { error: snapError } = await adminClient.from("post_metric_snapshots").insert(snapshots);
        if (snapError) console.error(`[metrics-cron] snapshot error org ${conn.organization_id}:`, snapError.message);
      }

      // Upsert métricas em batches de 50
      let upsertError: string | null = null;
      for (let i = 0; i < upsertRows.length; i += 50) {
        const { error } = await adminClient
          .from("post_metrics")
          .upsert(upsertRows.slice(i, i + 50), { onConflict: "external_id" });
        if (error) { upsertError = error.message; break; }
      }

      results.push({
        orgId: conn.organization_id,
        email: conn.google_email,
        videos: videos.length,
        snapshots: snapshots.length,
        error: upsertError
      });
    } catch (err) {
      results.push({
        orgId: conn.organization_id,
        error: err instanceof Error ? err.message : "Erro desconhecido"
      });
    }
  }

  return NextResponse.json({ ok: true, executedAt: new Date().toISOString(), results });
}

export const POST = GET;
