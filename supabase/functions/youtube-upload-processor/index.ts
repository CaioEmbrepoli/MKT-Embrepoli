// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CHUNK_SIZE = 32 * 1024 * 1024;
const RUN_BUDGET_MS = 130_000;
const YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

type QueueJob = {
  id: string;
  organization_id: string;
  post_id: string | null;
  post_publication_id: string | null;
  asset_url: string;
  title: string;
  description: string;
  format: string;
  scheduled_at: string | null;
  thumbnail_url: string | null;
  status: string;
  upload_url: string | null;
  bytes_uploaded: number | null;
  file_size: number | null;
  content_type: string | null;
  attempts: number | null;
};

type GoogleConnection = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} nao configurado.`);
  return value;
}

function getJwtRole(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const data = JSON.parse(jsonPayload);
    return typeof data?.role === "string" ? data.role : null;
  } catch {
    return null;
  }
}

function sanitizeDiagnosticMessage(value: unknown) {
  return String(value ?? "Erro desconhecido.")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/access_token=([^&\s]+)/gi, "access_token=[redacted]")
    .replace(/refresh_token=([^&\s]+)/gi, "refresh_token=[redacted]")
    .slice(0, 500);
}

async function recordQueueDiagnostic(service: ReturnType<typeof createClient>, job: QueueJob, error: unknown) {
  const technicalMessage = sanitizeDiagnosticMessage(error instanceof Error ? error.message : error);
  await service.rpc("upsert_error_log_event", {
    p_organization_id: job.organization_id,
    p_provider: "youtube",
    p_service: "youtube",
    p_error_code: "provider_api_error",
    p_user_message: "A fila de upload do YouTube não conseguiu concluir este vídeo.",
    p_technical_message: technicalMessage,
    p_action: "retry",
    p_profile_id: job.created_by ?? null,
    p_category: "fila",
    p_severity: "critico",
    p_event_key: `fila:youtube:job:${job.id}`,
    p_title: "Falha na fila de upload do YouTube",
    p_target_kind: "youtube_upload_queue",
    p_target_id: job.id,
    p_metadata: { postId: job.post_id, publicationId: job.post_publication_id }
  });
}

function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

async function exchangeRefreshToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Nao foi possivel renovar a conexao Google.");
  }
  return {
    accessToken: String(data.access_token),
    expiresAt: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000).toISOString()
  };
}

async function getGoogleAccessToken(service: ReturnType<typeof createClient>, organizationId: string, googleService: "drive" | "youtube") {
  const { data, error } = await service
    .from("google_connections")
    .select("id, access_token, refresh_token, expires_at")
    .eq("organization_id", organizationId)
    .eq("service", googleService)
    .maybeSingle();
  if (error) throw error;
  const connection = data as GoogleConnection | null;
  if (!connection?.refresh_token) throw new Error(`${googleService} nao conectado.`);
  const expiresAt = new Date(connection.expires_at || 0).getTime();
  if (connection.access_token && expiresAt > Date.now() + 60_000) return connection.access_token;
  const refreshed = await exchangeRefreshToken(connection.refresh_token);
  const { error: updateError } = await service
    .from("google_connections")
    .update({
      access_token: refreshed.accessToken,
      expires_at: refreshed.expiresAt,
      updated_at: new Date().toISOString()
    })
    .eq("id", connection.id);
  if (updateError) throw updateError;
  return refreshed.accessToken;
}

async function pickJob(service: ReturnType<typeof createClient>, requestedJobId: string | null) {
  if (requestedJobId) {
    const { data, error } = await service
      .from("youtube_upload_queue")
      .select("*")
      .eq("id", requestedJobId)
      .in("status", ["pending", "processing"])
      .maybeSingle();
    if (error) throw error;
    return data as QueueJob | null;
  }

  const staleIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await service
    .from("youtube_upload_queue")
    .select("*")
    .or(`status.eq.pending,and(status.eq.processing,last_heartbeat_at.lt.${staleIso})`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as QueueJob | null;
}

async function markProcessing(service: ReturnType<typeof createClient>, job: QueueJob) {
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("youtube_upload_queue")
    .update({
      status: "processing",
      attempts: Number(job.attempts ?? 0) + 1,
      locked_at: now,
      last_heartbeat_at: now,
      error_message: null,
      updated_at: now
    })
    .eq("id", job.id)
    .in("status", ["pending", "processing"])
    .select("*")
    .single();
  if (error) throw error;
  return data as QueueJob;
}

async function initUploadSession(job: QueueJob, youtubeToken: string) {
  const scheduledDate = job.scheduled_at ? new Date(job.scheduled_at) : null;
  const videoStatus = scheduledDate
    ? { privacyStatus: "private", publishAt: scheduledDate.toISOString(), selfDeclaredMadeForKids: false }
    : { privacyStatus: "public", selfDeclaredMadeForKids: false };
  const response = await fetch(YOUTUBE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${youtubeToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": job.content_type || "video/mp4",
      "X-Upload-Content-Length": String(job.file_size || 0)
    },
    body: JSON.stringify({
      snippet: { title: job.title, description: job.description, categoryId: "22" },
      status: videoStatus
    })
  });
  const uploadUrl = response.headers.get("location");
  if (!response.ok || !uploadUrl) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || `YouTube nao iniciou upload resumable (${response.status}).`);
  }
  return uploadUrl;
}

async function queryUploadOffset(uploadUrl: string, fileSize: number) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": "0",
      "Content-Range": `bytes */${fileSize}`
    }
  });
  if (response.status === 308) {
    const range = response.headers.get("range");
    const match = range?.match(/bytes=0-(\d+)/);
    return match ? Number(match[1]) + 1 : 0;
  }
  if (response.ok) return fileSize;
  return 0;
}

async function fetchDriveChunk(assetUrl: string, driveToken: string, start: number, end: number) {
  const fileId = extractDriveFileId(assetUrl);
  if (!fileId) throw new Error("Upload em fila suporta primeiro arquivos do Google Drive.");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${driveToken}`,
      Range: `bytes=${start}-${end}`
    }
  });
  if (!response.ok && response.status !== 206) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Nao foi possivel baixar chunk do Drive (${response.status}).`);
  }
  return response.arrayBuffer();
}

async function uploadChunk(uploadUrl: string, contentType: string, fileSize: number, start: number, chunk: ArrayBuffer) {
  const end = start + chunk.byteLength - 1;
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType || "video/mp4",
      "Content-Length": String(chunk.byteLength),
      "Content-Range": `bytes ${start}-${end}/${fileSize}`
    },
    body: chunk
  });

  if (response.status === 308) {
    const range = response.headers.get("range");
    const match = range?.match(/bytes=0-(\d+)/);
    return { complete: false, offset: match ? Number(match[1]) + 1 : end + 1, videoId: null as string | null };
  }
  if (response.ok) {
    const data = await response.json().catch(() => ({}));
    return { complete: true, offset: fileSize, videoId: data?.id ? String(data.id) : null };
  }
  const data = await response.json().catch(() => ({}));
  throw new Error(data?.error?.message || `Erro no upload YouTube (${response.status}).`);
}

async function createMetricAfterPublish(service: ReturnType<typeof createClient>, job: QueueJob, videoId: string, publishedAt: string) {
  let channelId = "youtube";
  const { data: byId } = await service.from("channels").select("id").eq("organization_id", job.organization_id).eq("id", "youtube").maybeSingle();
  if (byId?.id) channelId = byId.id;
  else {
    const { data: byName } = await service.from("channels").select("id").eq("organization_id", job.organization_id).ilike("name", "%youtube%").maybeSingle();
    if (byName?.id) channelId = byName.id;
  }

  await service.from("post_metrics").upsert({
    id: crypto.randomUUID(),
    organization_id: job.organization_id,
    external_id: `yt:${videoId}`,
    post_id: job.post_id,
    post_title: job.title || "Post publicado",
    channel_id: channelId,
    metric_date: publishedAt.slice(0, 10),
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
    leads: 0,
    notes: "",
    learning: "",
    video_type: String(job.format || "").toLowerCase().includes("short") ? "short" : "video",
    privacy_status: "public",
    source_url: `https://www.youtube.com/watch?v=${videoId}`,
    embed_url: `https://www.youtube.com/watch?v=${videoId}`
  }, { onConflict: "external_id", ignoreDuplicates: true });
}

function derivePostStatusFromPublications(currentStatus: string | null, publications: Array<{ status: string | null }>) {
  if (publications.some((publication) => publication.status === "published")) return "Publicado";
  if (publications.some((publication) => ["scheduled", "pending", "processing"].includes(String(publication.status)))) {
    return "Agendado";
  }
  return currentStatus || "Produção";
}

async function syncPostStatusFromPublications(
  service: ReturnType<typeof createClient>,
  job: QueueJob,
  publishedAt: string | null,
  videoId: string
) {
  if (!job.post_id) return;

  const { data: post } = await service
    .from("posts")
    .select("id,status,published_at")
    .eq("organization_id", job.organization_id)
    .eq("id", job.post_id)
    .maybeSingle();

  if (!post) return;

  const { data: publications } = await service
    .from("post_publications")
    .select("status")
    .eq("organization_id", job.organization_id)
    .eq("post_id", job.post_id);

  const nextStatus = derivePostStatusFromPublications(post.status, publications ?? []);
  const update: Record<string, string> = { published_video_id: videoId };
  if (nextStatus !== post.status) update.status = nextStatus;
  if (nextStatus === "Publicado" && publishedAt && !post.published_at) update.published_at = publishedAt;

  await service
    .from("posts")
    .update(update)
    .eq("organization_id", job.organization_id)
    .eq("id", job.post_id);
}

async function completeJob(service: ReturnType<typeof createClient>, job: QueueJob, videoId: string) {
  const now = new Date().toISOString();
  const isScheduled = Boolean(job.scheduled_at);
  await service.from("youtube_upload_queue").update({
    status: "uploaded",
    video_id: videoId,
    bytes_uploaded: job.file_size || 0,
    completed_at: now,
    last_heartbeat_at: now,
    updated_at: now
  }).eq("id", job.id);

  if (job.post_publication_id) {
    await service.from("post_publications").update({
      status: isScheduled ? "scheduled" : "published",
      external_id: videoId,
      permalink: `https://www.youtube.com/watch?v=${videoId}`,
      published_at: isScheduled ? null : now,
      error: null,
      updated_at: now
    }).eq("id", job.post_publication_id);
  }

  await syncPostStatusFromPublications(service, job, isScheduled ? null : now, videoId);

  if (!isScheduled) {
    await createMetricAfterPublish(service, job, videoId, now).catch(() => undefined);
  }
}

async function processJob(service: ReturnType<typeof createClient>, requestedJobId: string | null) {
  const picked = await pickJob(service, requestedJobId);
  if (!picked) return { processed: false, reason: "Nenhum job pendente." };

  let job: QueueJob | null = null;
  try {
    job = await markProcessing(service, picked);
    const driveToken = await getGoogleAccessToken(service, job.organization_id, "drive");
    const youtubeToken = await getGoogleAccessToken(service, job.organization_id, "youtube");
    const fileSize = Number(job.file_size || 0);
    if (!fileSize) throw new Error("Job sem file_size.");

    let uploadUrl = job.upload_url;
    if (!uploadUrl) {
      uploadUrl = await initUploadSession(job, youtubeToken);
      const now = new Date().toISOString();
      await service.from("youtube_upload_queue").update({ upload_url: uploadUrl, updated_at: now, last_heartbeat_at: now }).eq("id", job.id);
      job = { ...job, upload_url: uploadUrl };
    }

    let offset = await queryUploadOffset(uploadUrl, fileSize);
    offset = Math.max(offset, Number(job.bytes_uploaded || 0));
    const deadline = Date.now() + RUN_BUDGET_MS;

    while (offset < fileSize && Date.now() < deadline) {
      const end = Math.min(offset + CHUNK_SIZE - 1, fileSize - 1);
      const chunk = await fetchDriveChunk(job.asset_url, driveToken, offset, end);
      const result = await uploadChunk(uploadUrl, job.content_type || "video/mp4", fileSize, offset, chunk);
      offset = result.offset;
      const now = new Date().toISOString();
      await service.from("youtube_upload_queue").update({
        bytes_uploaded: offset,
        last_heartbeat_at: now,
        updated_at: now
      }).eq("id", job.id);
      if (result.complete) {
        const videoId = result.videoId;
        if (!videoId) throw new Error("YouTube concluiu upload sem retornar video_id.");
        await completeJob(service, { ...job, file_size: fileSize }, videoId);
        return { processed: true, jobId: job.id, status: "uploaded", videoId };
      }
    }

    await service.from("youtube_upload_queue").update({
      status: "pending",
      bytes_uploaded: offset,
      last_heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("id", job.id);
    return { processed: true, jobId: job.id, status: "pending", bytesUploaded: offset, fileSize };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await service.from("youtube_upload_queue").update({
      status: "failed",
      error_message: message,
      last_heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("id", (job ?? picked).id);
    await recordQueueDiagnostic(service, job ?? picked, error).catch(() => undefined);
    throw error;
  }
}

serve(async (request) => {
  try {
    if (getJwtRole(request) !== "service_role") {
      return json({ ok: false, error: "Nao autorizado." }, 401);
    }

    const supabaseUrl = env("SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const body = await request.json().catch(() => ({})) as { jobId?: string; record?: { id?: string } };
    const jobId = body.jobId || body.record?.id || new URL(request.url).searchParams.get("jobId");
    const result = await processJob(service, jobId ?? null);
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Erro desconhecido." }, 500);
  }
});
