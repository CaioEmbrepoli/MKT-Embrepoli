// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CHUNK_SIZE = 32 * 1024 * 1024;
const RUN_BUDGET_MS = 130_000;

type QueueJob = {
  id: string;
  organization_id: string;
  post_id: string | null;
  post_publication_id: string | null;
  created_by: string | null;
  asset_url: string;
  title: string;
  description: string;
  format: string;
  privacy_level: string;
  scheduled_at: string | null;
  status: string;
  publish_id: string | null;
  upload_url: string | null;
  bytes_uploaded: number | null;
  file_size: number | null;
  content_type: string | null;
  attempts: number | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function getJwtRole(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")))?.role || null;
  } catch {
    return null;
  }
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} nao configurado.`);
  return value;
}

function extractDriveFileId(url: string): string | null {
  return url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]
    ?? null;
}

function tiktokEnvironment() {
  return Deno.env.get("TIKTOK_ENV") === "production" ? "production" : "sandbox";
}

function clientCredential(name: "key" | "secret") {
  const environment = tiktokEnvironment();
  if (name === "key") return environment === "production" ? env("TIKTOK_CLIENT_KEY") : (Deno.env.get("TIKTOK_SANDBOX_CLIENT_KEY") || env("TIKTOK_CLIENT_KEY"));
  return environment === "production" ? env("TIKTOK_CLIENT_SECRET") : (Deno.env.get("TIKTOK_SANDBOX_CLIENT_SECRET") || env("TIKTOK_CLIENT_SECRET"));
}

function sanitize(value: unknown) {
  return String(value ?? "Erro desconhecido.")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/access_token=([^&\s]+)/gi, "access_token=[redacted]")
    .replace(/refresh_token=([^&\s]+)/gi, "refresh_token=[redacted]")
    .slice(0, 500);
}

async function recordDiagnostic(service: ReturnType<typeof createClient>, job: QueueJob, error: unknown) {
  await service.rpc("upsert_error_log_event", {
    p_organization_id: job.organization_id,
    p_provider: "tiktok",
    p_service: "tiktok",
    p_error_code: "provider_api_error",
    p_user_message: "A fila de upload do TikTok nao conseguiu concluir este video.",
    p_technical_message: sanitize(error instanceof Error ? error.message : error),
    p_action: "retry",
    p_profile_id: job.created_by,
    p_category: "fila",
    p_severity: "critico",
    p_event_key: `fila:tiktok:job:${job.id}`,
    p_title: "Falha na fila de upload do TikTok",
    p_target_kind: "tiktok_upload_queue",
    p_target_id: job.id,
    p_metadata: { postId: job.post_id, publicationId: job.post_publication_id },
  });
}

async function getTikTokAccessToken(service: ReturnType<typeof createClient>, organizationId: string) {
  const environment = tiktokEnvironment();
  const { data: connection, error } = await service
    .from("tiktok_connections")
    .select("id,access_token,refresh_token,expires_at,refresh_expires_at")
    .eq("organization_id", organizationId)
    .eq("environment", environment)
    .maybeSingle();
  if (error) throw error;
  if (!connection?.refresh_token) throw new Error("TikTok nao conectado para esta organizacao.");
  if (connection.access_token && new Date(connection.expires_at || 0).getTime() > Date.now() + 60_000) return connection.access_token;

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientCredential("key"),
      client_secret: clientCredential("secret"),
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Nao foi possivel renovar a conexao TikTok.");
  const now = new Date().toISOString();
  await service.from("tiktok_connections").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || connection.refresh_token,
    expires_at: new Date(Date.now() + Number(data.expires_in || 86400) * 1000).toISOString(),
    refresh_expires_at: data.refresh_expires_in ? new Date(Date.now() + Number(data.refresh_expires_in) * 1000).toISOString() : connection.refresh_expires_at,
    updated_at: now,
  }).eq("id", connection.id);
  return data.access_token as string;
}

async function pickJob(service: ReturnType<typeof createClient>, requestedJobId: string | null) {
  const now = new Date().toISOString();
  if (requestedJobId) {
    const { data, error } = await service.from("tiktok_upload_queue").select("*").eq("id", requestedJobId).in("status", ["pending", "processing"]).maybeSingle();
    if (error) throw error;
    if (data?.scheduled_at && new Date(data.scheduled_at).getTime() > Date.now()) return null;
    return data as QueueJob | null;
  }
  const staleIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await service
    .from("tiktok_upload_queue")
    .select("*")
    .or(`status.eq.pending,and(status.eq.processing,last_heartbeat_at.lt.${staleIso})`)
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as QueueJob | null;
}

async function markProcessing(service: ReturnType<typeof createClient>, job: QueueJob) {
  const now = new Date().toISOString();
  const { data, error } = await service.from("tiktok_upload_queue").update({
    status: "processing", attempts: Number(job.attempts || 0) + 1, locked_at: now, last_heartbeat_at: now, error_message: null, updated_at: now,
  }).eq("id", job.id).in("status", ["pending", "processing"]).select("*").single();
  if (error) throw error;
  return data as QueueJob;
}

async function initUpload(job: QueueJob, accessToken: string) {
  const fileSize = Number(job.file_size || 0);
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      post_info: {
        title: job.title.slice(0, 150), privacy_level: job.privacy_level || "PUBLIC_TO_EVERYONE",
        disable_duet: false, disable_comment: false, disable_stitch: false, video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "FILE_UPLOAD", video_size: fileSize, chunk_size: Math.min(CHUNK_SIZE, fileSize), total_chunk_count: Math.ceil(fileSize / CHUNK_SIZE),
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data.error?.code && data.error.code !== "ok") || !data.data?.publish_id || !data.data?.upload_url) {
    throw new Error(data.error?.message || "TikTok nao iniciou o upload em fila.");
  }
  return { publishId: String(data.data.publish_id), uploadUrl: String(data.data.upload_url) };
}

async function queryOffset(uploadUrl: string, fileSize: number, fallback: number) {
  const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Length": "0", "Content-Range": `bytes */${fileSize}` } });
  if (response.status === 308) {
    const match = response.headers.get("range")?.match(/bytes=0-(\d+)/);
    return match ? Number(match[1]) + 1 : 0;
  }
  if (response.ok) return fileSize;
  return fallback;
}

async function fetchChunk(service: ReturnType<typeof createClient>, job: QueueJob, start: number, end: number) {
  const fileId = extractDriveFileId(job.asset_url);
  if (fileId) {
    const token = await getGoogleDriveToken(service, job.organization_id);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${token}`, Range: `bytes=${start}-${end}` } });
    if (!response.ok && response.status !== 206) throw new Error(`Nao foi possivel baixar um bloco do Google Drive (${response.status}).`);
    return response.arrayBuffer();
  }
  const response = await fetch(job.asset_url, { headers: { Range: `bytes=${start}-${end}` } });
  if (!response.ok && response.status !== 206) throw new Error(`Nao foi possivel baixar um bloco do video (${response.status}).`);
  return response.arrayBuffer();
}

async function getGoogleDriveToken(service: ReturnType<typeof createClient>, organizationId: string) {
  const { data, error } = await service.from("google_connections").select("id,access_token,refresh_token,expires_at").eq("organization_id", organizationId).eq("service", "drive").maybeSingle();
  if (error) throw error;
  if (!data?.refresh_token) throw new Error("Google Drive precisa estar conectado para a fila do TikTok.");
  if (data.access_token && new Date(data.expires_at || 0).getTime() > Date.now() + 60_000) {
    return data.access_token as string;
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const refreshed = await response.json().catch(() => ({}));
  if (!response.ok || !refreshed.access_token) {
    throw new Error(refreshed.error_description || refreshed.error || "Nao foi possivel renovar a conexao Google Drive.");
  }
  const accessToken = String(refreshed.access_token);
  await service.from("google_connections").update({
    access_token: accessToken,
    expires_at: new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", data.id);
  return accessToken;
}

async function uploadChunk(uploadUrl: string, contentType: string, fileSize: number, start: number, chunk: ArrayBuffer) {
  const end = start + chunk.byteLength - 1;
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType || "video/mp4", "Content-Length": String(chunk.byteLength), "Content-Range": `bytes ${start}-${end}/${fileSize}` },
    body: chunk,
  });
  if (!response.ok && response.status !== 206 && response.status !== 308) {
    throw new Error(`TikTok recusou o bloco ${start}-${end} (${response.status}).`);
  }
  const match = response.headers.get("range")?.match(/bytes=0-(\d+)/);
  return match ? Number(match[1]) + 1 : end + 1;
}

async function completeJob(service: ReturnType<typeof createClient>, job: QueueJob) {
  const now = new Date().toISOString();
  await service.from("tiktok_upload_queue").update({
    status: "uploaded", bytes_uploaded: job.file_size || 0, completed_at: now, last_heartbeat_at: now, updated_at: now,
  }).eq("id", job.id);
  if (job.post_publication_id) {
    await service.from("post_publications").update({
      status: "processing", external_id: job.publish_id, error: null, last_attempt_at: now, updated_at: now,
    }).eq("id", job.post_publication_id);
  }
}

async function failJob(service: ReturnType<typeof createClient>, job: QueueJob, error: unknown) {
  const message = sanitize(error instanceof Error ? error.message : error);
  const now = new Date().toISOString();
  await service.from("tiktok_upload_queue").update({ status: "failed", error_message: message, last_heartbeat_at: now, updated_at: now }).eq("id", job.id);
  if (job.post_publication_id) {
    await service.from("post_publications").update({ status: "error", error: "A fila de upload do TikTok falhou.", last_attempt_at: now, updated_at: now }).eq("id", job.post_publication_id);
  }
  await recordDiagnostic(service, job, error).catch(() => undefined);
}

serve(async (request) => {
  let service: ReturnType<typeof createClient> | null = null;
  let activeJob: QueueJob | null = null;
  try {
    if (getJwtRole(request) !== "service_role") return json({ ok: false, error: "Nao autorizado." }, 401);
    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const payload = await request.json().catch(() => ({}));
    const requestedJobId = payload?.record?.id || payload?.jobId || new URL(request.url).searchParams.get("jobId");
    const job = await pickJob(service, requestedJobId ? String(requestedJobId) : null);
    if (!job) return json({ ok: true, processed: false, reason: "no_due_job" });

    const lockedJob = await markProcessing(service, job);
    activeJob = lockedJob;
    const accessToken = await getTikTokAccessToken(service, lockedJob.organization_id);
    let publishId = lockedJob.publish_id;
    let uploadUrl = lockedJob.upload_url;
    if (!publishId || !uploadUrl) {
      const initialized = await initUpload(lockedJob, accessToken);
      publishId = initialized.publishId;
      uploadUrl = initialized.uploadUrl;
      await service.from("tiktok_upload_queue").update({ publish_id: publishId, upload_url: uploadUrl, updated_at: new Date().toISOString() }).eq("id", lockedJob.id);
    }

    let offset = lockedJob.bytes_uploaded || 0;
    if (lockedJob.upload_url) offset = await queryOffset(uploadUrl, Number(lockedJob.file_size), offset);
    const startedAt = Date.now();
    while (offset < Number(lockedJob.file_size)) {
      const end = Math.min(offset + CHUNK_SIZE, Number(lockedJob.file_size)) - 1;
      const chunk = await fetchChunk(service, lockedJob, offset, end);
      offset = await uploadChunk(uploadUrl, lockedJob.content_type || "video/mp4", Number(lockedJob.file_size), offset, chunk);
      const now = new Date().toISOString();
      await service.from("tiktok_upload_queue").update({ bytes_uploaded: offset, publish_id: publishId, upload_url: uploadUrl, last_heartbeat_at: now, updated_at: now }).eq("id", lockedJob.id);
      if (Date.now() - startedAt >= RUN_BUDGET_MS) {
        await service.from("tiktok_upload_queue").update({
          status: "pending", bytes_uploaded: offset, last_heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", lockedJob.id);
        return json({ ok: true, processed: true, status: "pending", bytesUploaded: offset });
      }
    }
    await completeJob(service, { ...lockedJob, publish_id: publishId, upload_url: uploadUrl, bytes_uploaded: offset });
    return json({ ok: true, processed: true, status: "uploaded", publishId });
  } catch (error) {
    console.error("[tiktok-upload-processor]", error);
    if (service && activeJob) await failJob(service, activeJob, error).catch(() => undefined);
    return json({ ok: false, error: sanitize(error instanceof Error ? error.message : error) }, 500);
  }
});
