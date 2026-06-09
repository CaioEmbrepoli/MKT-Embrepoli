import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exchangeRefreshToken } from "@/lib/google-server";
import { upsertServerComments, type ServerCommentInput } from "@/lib/comment-server";

export const dynamic = "force-dynamic";

// Polling de comentários recentes do canal YouTube.
//
// Roda via cron externo (ex: cron-job.org) a cada 30 min das 8h às 18h.
// Usa allThreadsRelatedToChannelId para buscar os 100 comentários mais recentes
// do canal inteiro em UMA única chamada (custo: ~2 unidades de quota por rodada).
// Deduplicação automática via external_id — rodar várias vezes é seguro.

const MAX_RESULTS = 100;

async function ytFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `YouTube API error ${res.status}`);
  }
  return data;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 500 });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: connections, error } = await service
    .from("google_connections")
    .select("id, organization_id, refresh_token, access_token, expires_at")
    .eq("service", "youtube")
    .neq("refresh_token", "");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!connections?.length) {
    return NextResponse.json({ ok: true, results: [], message: "Nenhuma conexao YouTube encontrada." });
  }

  const results: Array<{
    organizationId: string;
    status: string;
    fetched?: number;
    upserted?: number;
    error?: string;
  }> = [];

  for (const conn of connections) {
    try {
      // Obtém access token válido, renovando via refresh_token se necessário
      let accessToken = conn.access_token as string;
      const expiresAt = new Date((conn.expires_at as string) || 0).getTime();
      if (!accessToken || expiresAt <= Date.now() + 60_000) {
        const refreshed = await exchangeRefreshToken(conn.refresh_token as string);
        accessToken = refreshed.accessToken;
        await service
          .from("google_connections")
          .update({
            access_token: refreshed.accessToken,
            expires_at: refreshed.expiresAt,
            updated_at: new Date().toISOString()
          })
          .eq("id", conn.id);
      }

      // Busca o ID e nome do canal (1 unidade de quota)
      const channelData = await ytFetch(
        "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
        accessToken
      );
      const channelId = channelData.items?.[0]?.id as string | undefined;
      const channelTitle = (channelData.items?.[0]?.snippet?.title as string) ?? "Canal YouTube";
      if (!channelId) {
        results.push({ organizationId: conn.organization_id as string, status: "no_channel" });
        continue;
      }

      // Busca os comentários mais recentes do canal inteiro (1 unidade de quota)
      const params = new URLSearchParams({
        part: "snippet",
        allThreadsRelatedToChannelId: channelId,
        order: "time",
        maxResults: String(MAX_RESULTS),
        textFormat: "plainText"
      });
      const commentsData = await ytFetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?${params}`,
        accessToken
      );

      const items: unknown[] = commentsData.items ?? [];
      if (!items.length) {
        results.push({ organizationId: conn.organization_id as string, status: "no_comments" });
        continue;
      }

      const commentInputs: ServerCommentInput[] = (items as Array<Record<string, unknown>>)
        .map((item) => {
          const snippet = (item.snippet as Record<string, unknown>) ?? {};
          const topLevel = (snippet.topLevelComment as Record<string, unknown>) ?? {};
          const s = (topLevel.snippet as Record<string, unknown>) ?? {};
          return {
            source: "youtube" as const,
            externalId: `yt_comment:${String(item.id ?? "")}`,
            videoId: String(snippet.videoId ?? ""),
            videoTitle: String(s.videoTitle ?? channelTitle),
            authorName: String(s.authorDisplayName ?? "Usuário YouTube"),
            text: String(s.textDisplay ?? ""),
            likes: Number(s.likeCount ?? 0),
            publishedAt: String(s.publishedAt ?? new Date().toISOString())
          };
        })
        .filter((c) => c.text && c.externalId !== "yt_comment:");

      if (!commentInputs.length) {
        results.push({ organizationId: conn.organization_id as string, status: "no_valid_comments" });
        continue;
      }

      const upserted = await upsertServerComments(service, conn.organization_id as string, commentInputs);
      results.push({
        organizationId: conn.organization_id as string,
        status: "ok",
        fetched: items.length,
        upserted: upserted.length
      });
    } catch (e) {
      results.push({
        organizationId: conn.organization_id as string,
        status: "error",
        error: e instanceof Error ? e.message : "erro desconhecido"
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
