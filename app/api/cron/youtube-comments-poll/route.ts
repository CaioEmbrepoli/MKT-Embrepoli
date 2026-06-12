import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exchangeRefreshToken } from "@/lib/google-server";
import { createServerQuestionsFromComments, upsertServerComments, type ServerCommentInput } from "@/lib/comment-server";

export const dynamic = "force-dynamic";

// Polling de comentários recentes do canal YouTube.
//
// Roda via cron externo (ex: cron-job.org) a cada 5 min.
// channels?mine=true pode resolver para um canal/Brand Account diferente do
// canal oficial quando a conta autenticada gerencia múltiplos canais, fazendo
// allThreadsRelatedToChannelId retornar vazio. Por isso resolvemos o canal
// pelo handle público da Embrepoli (forHandle) e usamos esse channelId.
// Com o channelId correto, allThreadsRelatedToChannelId traz comentários
// recentes de QUALQUER vídeo do canal em uma única chamada. Se ainda assim
// vier vazio, caímos de volta para buscar comentários por vídeo (playlist de
// uploads) como segurança.
// Deduplicação automática via external_id — rodar várias vezes é seguro.

const EMBREPOLI_YT_HANDLE = "EmbrepoliTurbos";
const MAX_RESULTS = 100;
const MAX_VIDEOS = 15;
const MAX_VIDEO_AGE_DAYS = 60;
const MAX_COMMENTS_PER_VIDEO = 25;

async function ytFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `YouTube API error ${res.status}`);
  }
  return data;
}

export async function GET() {
  const executedAt = new Date().toISOString();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, executedAt, error: "Supabase nao configurado." }, { status: 500 });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: connections, error } = await service
    .from("google_connections")
    .select("id, organization_id, refresh_token, access_token, expires_at")
    .eq("service", "youtube")
    .neq("refresh_token", "");

  if (error) return NextResponse.json({ ok: false, executedAt, error: error.message }, { status: 500 });
  if (!connections?.length) {
    return NextResponse.json({
      ok: true,
      executedAt,
      connectionsFound: 0,
      connectionsProcessed: 0,
      results: [],
      message: "Nenhuma conexao YouTube encontrada."
    });
  }

  const results: Array<{
    connectionId: string;
    organizationId: string;
    status: string;
    channelId?: string;
    channelTitle?: string;
    videosChecked?: number;
    fetched?: number;
    upserted?: number;
    questionsCreated?: number;
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

      // Resolve o canal oficial da Embrepoli pelo handle público (1 unidade de quota)
      const channelData = await ytFetch(
        `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,contentDetails&forHandle=${encodeURIComponent(`@${EMBREPOLI_YT_HANDLE}`)}`,
        accessToken
      );
      const channelId = channelData.items?.[0]?.id as string | undefined;
      const channelTitle = (channelData.items?.[0]?.snippet?.title as string) ?? "Canal YouTube";
      const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads as string | undefined;
      if (!channelId) {
        results.push({
          connectionId: conn.id as string,
          organizationId: conn.organization_id as string,
          status: "no_channel"
        });
        continue;
      }

      const commentInputs: ServerCommentInput[] = [];
      let videosChecked = 0;
      let usedFallback = false;

      // Tentativa 1: comentários recentes de QUALQUER vídeo do canal, em uma única chamada
      const channelParams = new URLSearchParams({
        part: "snippet",
        allThreadsRelatedToChannelId: channelId,
        order: "time",
        maxResults: String(MAX_RESULTS),
        textFormat: "plainText"
      });
      const channelCommentsData = await ytFetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?${channelParams}`,
        accessToken
      );
      const channelItems = (channelCommentsData.items as Array<Record<string, unknown>>) ?? [];

      for (const item of channelItems) {
        const snippet = (item.snippet as Record<string, unknown>) ?? {};
        const topLevel = (snippet.topLevelComment as Record<string, unknown>) ?? {};
        const s = (topLevel.snippet as Record<string, unknown>) ?? {};
        const text = String(s.textDisplay ?? "");
        const externalId = `yt_comment:${String(item.id ?? "")}`;
        if (!text || externalId === "yt_comment:") continue;
        commentInputs.push({
          source: "youtube" as const,
          externalId,
          videoId: String(snippet.videoId ?? ""),
          videoTitle: String(s.videoTitle ?? channelTitle),
          authorName: String(s.authorDisplayName ?? "Usuário YouTube"),
          text,
          likes: Number(s.likeCount ?? 0),
          publishedAt: String(s.publishedAt ?? new Date().toISOString())
        });
      }

      // Tentativa 2 (fallback): se a busca pelo canal não trouxe nada, busca por vídeo
      if (!commentInputs.length && uploadsPlaylistId) {
        usedFallback = true;
        const playlistParams = new URLSearchParams({
          part: "snippet,contentDetails",
          playlistId: uploadsPlaylistId,
          maxResults: String(MAX_VIDEOS)
        });
        const playlistData = await ytFetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams}`,
          accessToken
        );

        const minPublishedAt = Date.now() - MAX_VIDEO_AGE_DAYS * 24 * 60 * 60 * 1000;
        const videos: Array<{ videoId: string; title: string }> = (playlistData.items ?? [])
          .map((item: Record<string, unknown>) => {
            const snippet = (item.snippet as Record<string, unknown>) ?? {};
            const contentDetails = (item.contentDetails as Record<string, unknown>) ?? {};
            return {
              videoId: String(contentDetails.videoId ?? ""),
              title: String(snippet.title ?? channelTitle),
              publishedAt: String(contentDetails.videoPublishedAt ?? snippet.publishedAt ?? "")
            };
          })
          .filter((v: { videoId: string; publishedAt: string }) => v.videoId && (!v.publishedAt || new Date(v.publishedAt).getTime() >= minPublishedAt));

        videosChecked = videos.length;

        for (const video of videos) {
          const commentParams = new URLSearchParams({
            part: "snippet",
            videoId: video.videoId,
            order: "time",
            maxResults: String(MAX_COMMENTS_PER_VIDEO),
            textFormat: "plainText"
          });
          let commentsData: Record<string, unknown>;
          try {
            commentsData = await ytFetch(
              `https://www.googleapis.com/youtube/v3/commentThreads?${commentParams}`,
              accessToken
            );
          } catch {
            // Comentários desativados ou erro pontual nesse vídeo - segue para o próximo
            continue;
          }

          const items = (commentsData.items as Array<Record<string, unknown>>) ?? [];
          for (const item of items) {
            const snippet = (item.snippet as Record<string, unknown>) ?? {};
            const topLevel = (snippet.topLevelComment as Record<string, unknown>) ?? {};
            const s = (topLevel.snippet as Record<string, unknown>) ?? {};
            const text = String(s.textDisplay ?? "");
            const externalId = `yt_comment:${String(item.id ?? "")}`;
            if (!text || externalId === "yt_comment:") continue;
            commentInputs.push({
              source: "youtube" as const,
              externalId,
              videoId: String(snippet.videoId ?? video.videoId),
              videoTitle: video.title,
              authorName: String(s.authorDisplayName ?? "Usuário YouTube"),
              text,
              likes: Number(s.likeCount ?? 0),
              publishedAt: String(s.publishedAt ?? new Date().toISOString())
            });
          }
        }
      }

      if (!commentInputs.length) {
        results.push({
          connectionId: conn.id as string,
          organizationId: conn.organization_id as string,
          status: "no_comments",
          channelId,
          channelTitle,
          videosChecked: usedFallback ? videosChecked : undefined,
          fetched: 0,
          upserted: 0
        });
        continue;
      }

      const upserted = await upsertServerComments(service, conn.organization_id as string, commentInputs);
      const bankResult = await createServerQuestionsFromComments(service, conn.organization_id as string, upserted as Array<Record<string, any>>);
      results.push({
        connectionId: conn.id as string,
        organizationId: conn.organization_id as string,
        status: "ok",
        channelId,
        channelTitle,
        videosChecked: usedFallback ? videosChecked : undefined,
        fetched: commentInputs.length,
        upserted: upserted.length,
        questionsCreated: bankResult.created
      });
    } catch (e) {
      let errorMessage = "erro desconhecido";
      if (e instanceof Error) {
        errorMessage = e.message;
      } else if (e && typeof e === "object") {
        const obj = e as Record<string, unknown>;
        errorMessage = String(obj.message ?? obj.error ?? obj.error_description ?? JSON.stringify(e));
      } else if (e) {
        errorMessage = String(e);
      }
      results.push({
        connectionId: conn.id as string,
        organizationId: conn.organization_id as string,
        status: "error",
        error: errorMessage
      });
    }
  }

  return NextResponse.json({
    ok: true,
    executedAt,
    connectionsFound: connections.length,
    connectionsProcessed: results.length,
    results
  });
}
