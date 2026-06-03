import { Buffer } from "buffer";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { metaGraphVersion, type MetaRequestContext } from "./meta-server";
import { getGoogleAccessToken } from "./google-server";

export const INSTAGRAM_CONTENT_PUBLISH_SCOPE = "instagram_content_publish";

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
  effectiveFormat: InstagramPublishFormat;
  contentType: string;
};

export type InstagramScheduleResult = {
  containerId: string;
  scheduledPublishTime: string;
  effectiveFormat: InstagramPublishFormat;
  contentType: string;
};

type PreparedAsset = {
  publicUrl: string;
  contentType: string;
  buffer?: Buffer;
};

type MediaKind = "image" | "video";

type InstagramPublishPlan = {
  effectiveFormat: InstagramPublishFormat;
  kind: MediaKind;
  params: Record<string, string>;
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

function mediaKindLabel(contentType: string) {
  if (contentType.startsWith("image/")) return "imagem";
  if (contentType.startsWith("video/")) return "vídeo";
  return "arquivo";
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

  // Otimização: URLs já públicas (ex: Supabase storage de revisão) não precisam de re-download/upload.
  // Apenas Drive requer download + reupload (acesso autenticado).
  if (!isDrive && payload.assetUrl.startsWith("https://")) {
    const headRes = await fetch(payload.assetUrl, { method: "HEAD" }).catch(() => null);
    if (headRes?.ok) {
      const contentType = (headRes.headers.get("content-type") || "").split(";")[0].trim();
      if (contentType.startsWith("video/")) {
        // Vídeos públicos: usar URL diretamente — evita download/reupload que pode exceder timeout
        return { publicUrl: payload.assetUrl, contentType, buffer: Buffer.alloc(0) };
      }
      if (contentType.startsWith("image/")) {
        // Imagens: baixar apenas os primeiros bytes para validar dimensões de Story
        const rangeRes = await fetch(payload.assetUrl, { headers: { Range: "bytes=0-65535" } }).catch(() => null);
        const chunk = rangeRes && (rangeRes.ok || rangeRes.status === 206)
          ? Buffer.from(await rangeRes.arrayBuffer())
          : Buffer.alloc(0);
        return { publicUrl: payload.assetUrl, contentType, buffer: chunk };
      }
    }
  }

  // Drive: busca metadados primeiro para saber o tipo antes de baixar
  if (isDrive) {
    const fileId = extractDriveFileId(payload.assetUrl);
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

    const contentType = String(meta?.mimeType || "application/octet-stream").split(";")[0];
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      throw new Error("O Instagram aceita apenas imagem ou vídeo neste fluxo.");
    }

    await ensurePublicBucket(context.service);
    const ext = extensionForContentType(contentType);
    const filePath = `${context.organizationId}/${Date.now()}-${randomUUID()}.${ext}`;

    if (contentType.startsWith("video/")) {
      // Vídeos do Drive: streaming direto para o Supabase via HTTP para evitar OOM
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      if (!fileRes.ok) throw new Error("Erro ao baixar arquivo do Drive.");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
      const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${PUBLICATION_BUCKET}/${filePath}`;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — duplex necessário para streaming de request body no Node.js
      const uploadRes = await fetch(uploadEndpoint, {
        method: "POST",
        headers: { "Content-Type": contentType, Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        body: fileRes.body,
        duplex: "half",
      } as RequestInit);

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({})) as { message?: string; error?: string; statusCode?: string };
        const isTooBig = errData.message?.toLowerCase().includes("maximum allowed size") || errData.statusCode === "413";

        if (isTooBig) {
          // Fallback: tentar usar URL pública do Drive diretamente (funciona se o arquivo estiver compartilhado como público)
          const publicDriveUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`;
          const testRes = await fetch(publicDriveUrl, { method: "HEAD" }).catch(() => null);
          const ct = (testRes?.headers.get("content-type") || "").split(";")[0];
          if (testRes?.ok && ct.startsWith("video/")) {
            return { publicUrl: publicDriveUrl, contentType: ct || contentType, buffer: Buffer.alloc(0) };
          }
          throw new Error(
            "O vídeo do Drive excede o limite de 50MB do Supabase. " +
            "Solução: compartilhe o arquivo no Drive como 'Qualquer pessoa com o link pode visualizar', " +
            "ou envie o vídeo diretamente na revisão (sem usar link do Drive)."
          );
        }

        throw new Error(`Erro ao preparar arquivo publico: ${errData.message || errData.error || `HTTP ${uploadRes.status}`}`);
      }

      const publicUrl = context.service.storage.from(PUBLICATION_BUCKET).getPublicUrl(filePath).data.publicUrl;
      if (!publicUrl) throw new Error("Não foi possível gerar URL pública para a Meta.");
      return { publicUrl, contentType, buffer: Buffer.alloc(0) };
    }

    // Imagens do Drive: download completo necessário para validar dimensões de Story
    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });
    if (!fileRes.ok) throw new Error("Erro ao baixar arquivo do Drive.");
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    const { error } = await context.service.storage
      .from(PUBLICATION_BUCKET)
      .upload(filePath, buffer, { contentType, upsert: false });
    if (error) throw new Error(`Erro ao preparar arquivo publico: ${error.message}`);

    const publicUrl = context.service.storage.from(PUBLICATION_BUCKET).getPublicUrl(filePath).data.publicUrl;
    if (!publicUrl) throw new Error("Não foi possível gerar URL pública para a Meta.");
    return { publicUrl, contentType, buffer };
  }

  // URL não-pública que passou pela verificação HEAD: download + reupload
  const file = await fetchDirectFile(payload.assetUrl);
  const contentType = file.contentType.split(";")[0] || "application/octet-stream";

  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    throw new Error("O Instagram aceita apenas imagem ou vídeo neste fluxo.");
  }

  await ensurePublicBucket(context.service);
  const ext = extensionForContentType(contentType);
  const path = `${context.organizationId}/${Date.now()}-${randomUUID()}.${ext}`;
  const { error } = await context.service.storage
    .from(PUBLICATION_BUCKET)
    .upload(path, file.buffer, { contentType, upsert: false });
  if (error) throw new Error(`Erro ao preparar arquivo publico: ${error.message}`);

  const publicUrl = context.service.storage.from(PUBLICATION_BUCKET).getPublicUrl(path).data.publicUrl;
  if (!publicUrl) throw new Error("Não foi possível gerar URL pública para a Meta.");
  return { publicUrl, contentType, buffer: file.buffer };
}

async function assertMetaCanReadUrl(publicUrl: string) {
  try {
    const response = await fetch(publicUrl, { method: "HEAD" });
    if (response.ok) return;
  } catch {
    // Alguns storages/CDNs não respondem HEAD corretamente. Testa com GET abaixo.
  }

  const response = await fetch(publicUrl, { headers: { Range: "bytes=0-0" } });
  if (!response.ok && response.status !== 206) {
    throw new Error("A Meta precisa acessar uma URL pública da mídia. O arquivo preparado não ficou acessível.");
  }
}

function readUInt24LE(buffer: Buffer, offset: number) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function readImageDimensions(buffer?: Buffer): { width: number; height: number } | null {
  if (!buffer || buffer.length < 24) return null;

  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  if (isPng && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  const isGif = buffer.toString("ascii", 0, 3) === "GIF";
  if (isGif && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  const isWebp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (isWebp) {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X" && buffer.length >= 30) {
      return { width: readUInt24LE(buffer, 24) + 1, height: readUInt24LE(buffer, 27) + 1 };
    }
    if (chunk === "VP8 " && buffer.length >= 30) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L" && buffer.length >= 25) {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
      };
    }
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (
        marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3 ||
        marker === 0xc5 || marker === 0xc6 || marker === 0xc7 || marker === 0xc9 ||
        marker === 0xca || marker === 0xcb || marker === 0xcd || marker === 0xce || marker === 0xcf
      ) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }

  return null;
}

function validateStoryImage(asset: PreparedAsset) {
  const dimensions = readImageDimensions(asset.buffer);
  if (!dimensions) {
    throw new Error("Não foi possível validar as dimensões da imagem para Story. Envie uma imagem JPG, PNG ou WebP em formato vertical.");
  }

  if (dimensions.height <= dimensions.width) {
    throw new Error("Story precisa de mídia vertical. Use uma arte em 9:16, como 1080x1920.");
  }

  const ratio = dimensions.width / dimensions.height;
  if (ratio < 0.45 || ratio > 0.8) {
    throw new Error(`Story precisa estar próximo do formato vertical 9:16. A mídia atual é ${dimensions.width}x${dimensions.height}.`);
  }
}

function validateStoryVideo(asset: PreparedAsset) {
  const allowed = ["video/mp4", "video/quicktime", "video/mov", "video/webm", "video/x-m4v"];
  if (!allowed.includes(asset.contentType.toLowerCase())) {
    throw new Error("Story em vídeo precisa estar em MP4, MOV ou WebM.");
  }
}

function buildInstagramPublishPlan(payload: InstagramPublishPayload, asset: PreparedAsset): InstagramPublishPlan {
  const requestedFormat = normalizeFormat(payload.format);
  let effectiveFormat = requestedFormat;
  const isVideo = asset.contentType.startsWith("video/");
  const isImage = asset.contentType.startsWith("image/");

  if (!isVideo && !isImage) {
    throw new Error("O Instagram aceita apenas imagem ou vídeo neste fluxo.");
  }

  if (requestedFormat === "Feed" && isVideo) {
    effectiveFormat = "Reels";
  }

  const kind: MediaKind = isVideo ? "video" : "image";
  const params: Record<string, string> = {};

  if (effectiveFormat === "Reels") {
    if (!isVideo) {
      throw new Error(`Reels precisa de um vídeo. O arquivo selecionado é ${mediaKindLabel(asset.contentType)}.`);
    }
    params.media_type = "REELS";
    params.video_url = asset.publicUrl;
    if (payload.caption) params.caption = payload.caption;
    return { effectiveFormat, kind, params };
  }

  if (effectiveFormat === "Story") {
    params.media_type = "STORIES";
    if (isImage) {
      validateStoryImage(asset);
      params.image_url = asset.publicUrl;
    } else {
      validateStoryVideo(asset);
      params.video_url = asset.publicUrl;
    }
    return { effectiveFormat, kind, params };
  }

  if (!isImage) {
    throw new Error("Feed do Instagram precisa de imagem. Vídeos são publicados automaticamente como Reels.");
  }
  params.image_url = asset.publicUrl;
  if (payload.caption) params.caption = payload.caption;
  return { effectiveFormat, kind, params };
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

/** Verifica o status de containers de imagem (Story image) antes de publicar.
 *  Imagens processam rápido, mas o container pode levar alguns milliseconds.
 *  Máx 5s de espera — se não confirmar FINISHED, tenta publicar mesmo assim. */
async function waitForImageStoryContainer(connection: InstagramPublishConnection, creationId: string) {
  for (let i = 0; i < 5; i++) {
    const status = await graphGet<{ status_code?: string }>(connection, `/${creationId}`, { fields: "status_code" });
    if (status.status_code === "FINISHED" || !status.status_code) return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error("Erro ao processar o Story na Meta. Tente novamente em instantes.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export function assertInstagramPublishPermission(connection: InstagramPublishConnection) {
  const scopes = connection.scopes ?? [];
  const hasPublishScope =
    scopes.includes("instagram_content_publish") ||
    scopes.includes("instagram_business_content_publish");
  if (!hasPublishScope) {
    throw new Error("Token do Instagram sem permissao de publicacao. Reconecte o Instagram em Configuracoes.");
  }
}

async function prepareCoverUrl(context: MetaRequestContext, coverUrl: string): Promise<string> {
  const isDrive = /drive\.google\.com/i.test(coverUrl);
  const file = isDrive ? await fetchDriveFile(context, coverUrl) : await fetchDirectFile(coverUrl);
  const contentType = file.contentType.split(";")[0] || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error("A capa deve ser uma imagem (JPG ou PNG).");
  await ensurePublicBucket(context.service);
  const ext = extensionForContentType(contentType);
  const path = `${context.organizationId}/covers/${Date.now()}-${randomUUID()}.${ext}`;
  const { error } = await context.service.storage
    .from(PUBLICATION_BUCKET)
    .upload(path, file.buffer, { contentType, upsert: false });
  if (error) throw new Error(`Erro ao preparar capa publica: ${error.message}`);
  return context.service.storage.from(PUBLICATION_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function validateInstagramMediaForPublish(
  context: MetaRequestContext,
  connection: InstagramPublishConnection,
  payload: InstagramPublishPayload
) {
  assertInstagramPublishPermission(connection);
  const asset = await preparePublicAsset(context, payload);
  await assertMetaCanReadUrl(asset.publicUrl);
  const plan = buildInstagramPublishPlan(payload, asset);
  return {
    effectiveFormat: plan.effectiveFormat,
    contentType: asset.contentType,
    publicUrl: asset.publicUrl,
    kind: plan.kind
  };
}

export async function scheduleInstagramMedia(
  context: MetaRequestContext,
  connection: InstagramPublishConnection,
  payload: InstagramPublishPayload,
  scheduledAt: Date
): Promise<InstagramScheduleResult> {
  assertInstagramPublishPermission(connection);

  const asset = await preparePublicAsset(context, payload);
  await assertMetaCanReadUrl(asset.publicUrl);
  const plan = buildInstagramPublishPlan(payload, asset);

  if (plan.effectiveFormat === "Story") {
    throw new Error("Stories não suportam agendamento nativo. Publique imediatamente ou escolha Feed/Reels.");
  }

  const scheduledUnix = String(Math.floor(scheduledAt.getTime() / 1000));
  const params: Record<string, string> = { ...plan.params, published: "false", scheduled_publish_time: scheduledUnix };

  if (plan.effectiveFormat === "Reels" && payload.thumbnailUrl) {
    try { params.cover_url = await prepareCoverUrl(context, payload.thumbnailUrl); } catch { /* opcional */ }
  }

  const creation = await graphPost<{ id?: string }>(
    connection, `/${connection.instagram_account_id}/media`, params
  );
  if (!creation.id) throw new Error("A Meta não retornou o container de agendamento.");

  return {
    containerId: creation.id,
    scheduledPublishTime: scheduledAt.toISOString(),
    effectiveFormat: plan.effectiveFormat,
    contentType: asset.contentType
  };
}

export async function publishInstagramMedia(
  context: MetaRequestContext,
  connection: InstagramPublishConnection,
  payload: InstagramPublishPayload
): Promise<InstagramPublishResult> {
  assertInstagramPublishPermission(connection);

  const validatedAsset = await preparePublicAsset(context, payload);
  await assertMetaCanReadUrl(validatedAsset.publicUrl);
  const plan = buildInstagramPublishPlan(payload, validatedAsset);

  if (plan.effectiveFormat === "Reels" && payload.thumbnailUrl) {
    try {
      plan.params.cover_url = await prepareCoverUrl(context, payload.thumbnailUrl);
    } catch {
      // A capa e opcional; se falhar, continua sem cover_url.
    }
  }

  const creation = await graphPost<{ id?: string }>(connection, `/${connection.instagram_account_id}/media`, plan.params);
  if (!creation.id) throw new Error("A Meta nao retornou o container de publicacao.");
  if (plan.kind === "video") await waitForContainer(connection, creation.id);
  else if (plan.effectiveFormat === "Story") await waitForImageStoryContainer(connection, creation.id);

  const published = await graphPost<{ id?: string }>(connection, `/${connection.instagram_account_id}/media_publish`, {
    creation_id: creation.id
  });
  if (!published.id) throw new Error("A Meta nao retornou o ID da publicacao.");

  let validatedPermalink = "";
  try {
    const media = await graphGet<{ permalink?: string }>(connection, `/${published.id}`, { fields: "permalink" });
    validatedPermalink = media.permalink || "";
  } catch {
    validatedPermalink = "";
  }

  return {
    instagramMediaId: published.id,
    permalink: validatedPermalink,
    status: "published",
    publishedAt: new Date().toISOString(),
    effectiveFormat: plan.effectiveFormat,
    contentType: validatedAsset.contentType
  };

}
