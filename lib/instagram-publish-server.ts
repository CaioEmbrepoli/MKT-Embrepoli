import { Buffer } from "buffer";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { metaGraphVersion, type MetaRequestContext } from "./meta-server";
import { getGoogleAccessToken } from "./google-server";

export const INSTAGRAM_CONTENT_PUBLISH_SCOPE = "instagram_business_content_publish";

const PUBLICATION_BUCKET = "instagram-publications";

export type InstagramPublishFormat = "Feed" | "Reels" | "Story";

export type InstagramPublishConnection = {
  access_token: string;
  instagram_account_id: string;
  scopes?: string[] | null;
};

export type InstagramPublishPayload = {
  assetUrl: string;
  title?: string;
  caption?: string;
  format: string;
  thumbnailUrl?: string | null;
};

export type InstagramPublishResult = {
  instagramMediaId: string;
  permalink: string;
  status: "published";
  publishedAt: string;
};

type PreparedAsset = {
  publicUrl: string;
  contentType: string;
};

function graphBase(accessToken: string) {
  const isInstagramToken = accessToken.startsWith("IGAA") || accessToken.startsWith("IGQV") || accessToken.startsWith("IGQ");
  return isInstagramToken
    ? `https://graph.instagram.com/${metaGraphVersion()}`
    : `https://graph.facebook.com/${metaGraphVersion()}`;
}

function normalizeFormat(format: string): InstagramPublishFormat {
  const raw = String(format || "").toLowerCase();
  if (raw.includes("reel")) return "Reels";
  if (raw.includes("story") || raw.includes("stories")) return "Story";
  return "Feed";
}

function extensionForContentType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("video")) return "mp4";
  return "jpg";
}

function extractDriveFileId(url: string): string | null {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function readResponseBuffer(response: Response) {
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function fetchDriveFile(context: MetaRequestContext, assetUrl: string) {
  const fileId = extractDriveFileId(assetUrl);
  if (!fileId) throw new Error("Link do Google Drive invalido.");

  let driveToken: string;
  try {
    driveToken = await getGoogleAccessToken(context, "drive");
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Google Drive nao conectado.");
  }

  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`, {
    headers: { Authorization: `Bearer ${driveToken}` }
  });
  const meta = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok) throw new Error(meta?.error?.message ?? "Erro ao ler arquivo do Drive.");

  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${driveToken}` }
  });
  if (!fileRes.ok) throw new Error("Erro ao baixar arquivo do Drive.");

  return {
    buffer: await readResponseBuffer(fileRes),
    contentType: String(meta?.mimeType || fileRes.headers.get("content-type") || "application/octet-stream")
  };
}

async function fetchDirectFile(assetUrl: string) {
  const response = await fetch(assetUrl);
  if (!response.ok) throw new Error(`Erro ao baixar arquivo (${response.status}).`);
  return {
    buffer: await readResponseBuffer(response),
    contentType: String(response.headers.get("content-type") || "application/octet-stream").split(";")[0]
  };
}

async function ensurePublicBucket(service: SupabaseClient) {
  const { error } = await service.storage.createBucket(PUBLICATION_BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) {
    console.warn("[instagram-publish] create bucket:", error.message);
  }
}

async function preparePublicAsset(context: MetaRequestContext, payload: InstagramPublishPayload): Promise<PreparedAsset> {
  const isDrive = /drive\.google\.com/i.test(payload.assetUrl);
  const file = isDrive ? await fetchDriveFile(context, payload.assetUrl) : await fetchDirectFile(payload.assetUrl);
  const contentType = file.contentType.split(";")[0] || "application/octet-stream";

  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    throw new Error("O Instagram aceita apenas imagem ou video neste fluxo.");
  }

  await ensurePublicBucket(context.service);
  const ext = extensionForContentType(contentType);
  const path = `${context.organizationId}/${Date.now()}-${randomUUID()}.${ext}`;
  const { error } = await context.service.storage
    .from(PUBLICATION_BUCKET)
    .upload(path, file.buffer, { contentType, upsert: false });
  if (error) throw new Error(`Erro ao preparar arquivo publico: ${error.message}`);

  const publicUrl = context.service.storage.from(PUBLICATION_BUCKET).getPublicUrl(path).data.publicUrl;
  if (!publicUrl) throw new Error("Nao foi possivel gerar URL publica para a Meta.");
  return { publicUrl, contentType };
}

async function graphPost<T>(connection: InstagramPublishConnection, path: string, params: Record<string, string>) {
  const url = new URL(`${graphBase(connection.access_token)}${path.startsWith("/") ? path : `/${path}`}`);
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) body.set(key, value);
  }
  body.set("access_token", connection.access_token);
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const errMsg = typeof data?.error === "string"
      ? data.error
      : (data?.error?.message ?? data?.error?.error_user_msg ?? `Erro ao publicar no Instagram (HTTP ${response.status}).`);
    throw new Error(errMsg);
  }
  return data as T;
}

async function graphGet<T>(connection: InstagramPublishConnection, path: string, params: Record<string, string> = {}) {
  const url = new URL(`${graphBase(connection.access_token)}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", connection.access_token);
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const errMsg = typeof data?.error === "string"
      ? data.error
      : (data?.error?.message ?? data?.error?.error_user_msg ?? `Erro ao consultar publicacao do Instagram (HTTP ${response.status}).`);
    throw new Error(errMsg);
  }
  return data as T;
}

async function waitForContainer(connection: InstagramPublishConnection, creationId: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const status = await graphGet<{ status_code?: string; status?: string }>(connection, `/${creationId}`, {
      fields: "status_code,status"
    });
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(status.status || "A Meta nao conseguiu processar o video.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error("A Meta ainda esta processando o video. Tente novamente em alguns minutos.");
}

export function assertInstagramPublishPermission(connection: InstagramPublishConnection) {
  if (!connection.scopes?.includes(INSTAGRAM_CONTENT_PUBLISH_SCOPE)) {
    throw new Error("Token do Instagram sem permissao de publicacao. Gere um novo token com instagram_business_content_publish.");
  }
}

export async function publishInstagramMedia(
  context: MetaRequestContext,
  connection: InstagramPublishConnection,
  payload: InstagramPublishPayload
): Promise<InstagramPublishResult> {
  assertInstagramPublishPermission(connection);

  const format = normalizeFormat(payload.format);
  const asset = await preparePublicAsset(context, payload);
  const isVideo = asset.contentType.startsWith("video/");
  const isImage = asset.contentType.startsWith("image/");
  if (format === "Feed" && isVideo) {
    throw new Error("Para video no Instagram, use o formato Reels. Feed aceita imagem neste fluxo.");
  }

  const params: Record<string, string> = {};
  if (format === "Reels") {
    if (!isVideo) throw new Error("Reels precisa de um arquivo de video.");
    params.media_type = "REELS";
    params.video_url = asset.publicUrl;
    if (payload.caption) params.caption = payload.caption;
    if (payload.thumbnailUrl) params.thumb_offset = "0";
  } else if (format === "Story") {
    params.media_type = "STORIES";
    if (isVideo) params.video_url = asset.publicUrl;
    if (isImage) params.image_url = asset.publicUrl;
  } else {
    params.image_url = asset.publicUrl;
    if (payload.caption) params.caption = payload.caption;
  }

  const creation = await graphPost<{ id?: string }>(connection, `/${connection.instagram_account_id}/media`, params);
  if (!creation.id) throw new Error("A Meta nao retornou o container de publicacao.");
  if (isVideo) await waitForContainer(connection, creation.id);

  const published = await graphPost<{ id?: string }>(connection, `/${connection.instagram_account_id}/media_publish`, {
    creation_id: creation.id
  });
  if (!published.id) throw new Error("A Meta nao retornou o ID da publicacao.");

  let permalink = "";
  try {
    const media = await graphGet<{ permalink?: string }>(connection, `/${published.id}`, { fields: "permalink" });
    permalink = media.permalink || "";
  } catch {
    permalink = "";
  }

  return {
    instagramMediaId: published.id,
    permalink,
    status: "published",
    publishedAt: new Date().toISOString()
  };
}

