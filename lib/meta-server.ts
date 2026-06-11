import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type MetaService = "instagram" | "ads";

// Scopes para Facebook Login (graph.facebook.com/dialog/oauth) — produto LEGADO, não usado pelo OAuth atual.
// Mantido apenas como referência/compatibilidade (ex: connect-token aceita conexões antigas).
export const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement"
];

// Scopes do Instagram Business Login (www.instagram.com/oauth/authorize → tokens IGAA...).
// É o produto que o app da Embrepoli tem habilitado/aprovado no Meta Developer.
export const INSTAGRAM_BUSINESS_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages"
];

export const META_ADS_SCOPES = [
  "ads_read",
  "business_management"
];

type MetaConnectionRow = {
  id: string;
  organization_id: string;
  service: MetaService;
  instagram_account_id: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  business_id: string | null;
  page_id: string | null;
  username: string;
  display_name: string;
  avatar_url: string;
  scopes: string[];
  access_token: string;
  expires_at: string | null;
  connected_by: string | null;
  connected_at: string;
  updated_at: string;
};

export type MetaRequestContext = {
  userId: string;
  organizationId: string;
  role: "admin" | "gestor" | "colaborador";
  active: boolean;
  service: SupabaseClient;
};

export type InstagramAccountInfo = {
  instagramAccountId: string;
  pageId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
};

export type InstagramMediaItem = {
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

export type InstagramMetricItem = InstagramMediaItem & {
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
  externalReplies?: {
    id: string;
    authorName: string;
    text: string;
    publishedAt: string;
    likes?: number;
    isOwnReply?: boolean;
  }[];
  channelReply?: string;
};

type InstagramCommentReplyItem = NonNullable<InstagramCommentItem["externalReplies"]>[number];

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error("Supabase nao configurado para Meta/Instagram.");
  return { url, anonKey, serviceKey };
}

export function metaGraphVersion() {
  return (process.env.META_GRAPH_API_VERSION || "v23.0").trim().replace(/^\/+/, "");
}

function metaGraphBase() {
  return `https://graph.facebook.com/${metaGraphVersion()}`;
}

/** Retorna a base URL correta por tipo de token.
 *  IGAA/IGQV/IGQ = Consumer token → graph.instagram.com
 *  EAA/outros    = Facebook User token → graph.facebook.com */
function igApiBase(accessToken: string): string {
  const isConsumer = accessToken.startsWith("IGAA") || accessToken.startsWith("IGQV") || accessToken.startsWith("IGQ");
  return isConsumer
    ? `https://graph.instagram.com/${metaGraphVersion()}`
    : metaGraphBase();
}

export async function metaRequestContext(request: Request): Promise<MetaRequestContext> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sessao nao informada.");

  const { url, anonKey, serviceKey } = supabaseEnv();
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) throw new Error("Sessao invalida.");

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: profile, error } = await service
    .from("profiles")
    .select("id, organization_id, role, active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (error || !profile) throw new Error("Perfil nao encontrado.");
  if (!profile.active) throw new Error("Usuario inativo.");

  return {
    userId: authData.user.id,
    organizationId: profile.organization_id,
    role: profile.role,
    active: Boolean(profile.active),
    service
  };
}

export function requireMetaManager(context: MetaRequestContext) {
  if (context.role !== "admin" && context.role !== "gestor") {
    throw new Error("Apenas Administrador ou Gestor pode gerenciar a conexao Meta/Instagram.");
  }
}

// --- OAuth Instagram Business Login helpers ---
// O produto "Instagram Business Login" do Meta Developer expõe um App ID / App Secret
// PRÓPRIOS (em Instagram > API setup with Instagram login), diferentes do App ID/Secret
// do Facebook Login. Preferimos INSTAGRAM_APP_ID/SECRET quando configurados, e caímos
// para META_APP_ID/SECRET (mesmo app, caso o painel exiba as mesmas credenciais).
export function instagramAppId() { return process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID || ""; }
export function instagramAppSecret() { return process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || ""; }
export function metaAppId() { return process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID || ""; }
export function metaAppSecret() { return process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || ""; }

export function instagramOAuthRedirectUri(request: Request) {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  return `${origin}/api/meta/instagram/oauth/callback`;
}

export function metaAdsOAuthRedirectUri(request: Request) {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  return `${origin}/api/meta/ads/oauth/callback`;
}

export function metaOAuthAuthorizeUrl() {
  return `https://www.facebook.com/${metaGraphVersion()}/dialog/oauth`;
}

export function metaOAuthAccessTokenUrl() {
  return `${metaGraphBase()}/oauth/access_token`;
}

// --- Endpoints nativos do Instagram Business Login (não passam por graph.facebook.com) ---
export const INSTAGRAM_OAUTH_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
export const INSTAGRAM_OAUTH_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
export function instagramGraphAccessTokenUrl() {
  return `https://graph.instagram.com/access_token`;
}
export function instagramGraphRefreshTokenUrl() {
  return `https://graph.instagram.com/refresh_access_token`;
}

function metaStateSecret() {
  return process.env.INSTAGRAM_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "embrepoli-instagram-oauth";
}

export function signMetaState(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", metaStateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyMetaState<T extends Record<string, unknown>>(state: string): T {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Estado OAuth invalido.");
  const expected = crypto.createHmac("sha256", metaStateSecret()).update(body).digest("base64url");
  if (Buffer.from(sig).length !== Buffer.from(expected).length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error("Assinatura OAuth invalida.");
  }
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
}

export async function getMetaConnection(supabaseClient: SupabaseClient, organizationId: string, service: MetaService = "instagram") {
  const { data, error } = await supabaseClient
    .from("meta_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("service", service)
    .maybeSingle();
  if (error) throw error;
  return data as MetaConnectionRow | null;
}

export async function getInstagramConnection(context: MetaRequestContext): Promise<MetaConnectionRow & { instagram_account_id: string }> {
  const connection = await getMetaConnection(context.service, context.organizationId, "instagram");
  if (!connection?.access_token || !connection.instagram_account_id) {
    throw new Error("Instagram / Meta nao conectado. Cadastre o token em Conta e Permissoes.");
  }
  if (connection.expires_at && new Date(connection.expires_at).getTime() < Date.now()) {
    throw new Error("Token do Instagram expirado. Gere um novo token no Meta Developer e atualize a conexao.");
  }
  return { ...connection, instagram_account_id: connection.instagram_account_id };
}

export async function getMetaAdsConnection(context: MetaRequestContext) {
  const connection = await getMetaConnection(context.service, context.organizationId, "ads");
  if (!connection?.access_token) {
    throw new Error("Meta Ads nao conectado. Conecte a conta em Conta e Permissoes.");
  }
  if (connection.expires_at && new Date(connection.expires_at).getTime() < Date.now()) {
    throw new Error("Token do Meta Ads expirado. Reconecte a conta de anuncios.");
  }
  return connection;
}

export async function graphGet<T>(pathOrUrl: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = pathOrUrl.startsWith("http")
    ? new URL(pathOrUrl)
    : new URL(`${metaGraphBase()}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || "Erro ao consultar a API da Meta.");
  }
  return data as T;
}

export async function graphPost<T>(pathOrUrl: string, accessToken: string, body: Record<string, string> = {}): Promise<T> {
  const url = pathOrUrl.startsWith("http")
    ? new URL(pathOrUrl)
    : new URL(`${metaGraphBase()}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`);
  const payload = new URLSearchParams({ ...body, access_token: accessToken });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || "Erro ao enviar dados para a API da Meta.");
  }
  return data as T;
}

export async function fetchInstagramAccount(accessToken: string): Promise<InstagramAccountInfo> {
  type MeResponse = { id?: string; username?: string; name?: string; profile_picture_url?: string };
  type PageResponse = {
    data?: Array<{
      id?: string;
      name?: string;
      instagram_business_account?: { id?: string; username?: string; profile_picture_url?: string };
    }>;
  };

  // Tokens IGAA/IGQV/IGQ são Instagram Graph API tokens — usam graph.instagram.com/me.
  // Tokens de usuário do Facebook (EAA...) usam graph.facebook.com/me/accounts.
  const isInstagramToken = accessToken.startsWith("IGAA") || accessToken.startsWith("IGQV") || accessToken.startsWith("IGQ");

  if (isInstagramToken) {
    // Instagram Graph API tokens precisam de graph.instagram.com, não graph.facebook.com
    const igBase = `https://graph.instagram.com/${metaGraphVersion()}`;
    const igUrl = new URL(`${igBase}/me`);
    igUrl.searchParams.set("fields", "id,username,name,profile_picture_url");
    igUrl.searchParams.set("access_token", accessToken);
    const igRes = await fetch(igUrl);
    const me = await igRes.json().catch(() => ({})) as MeResponse & { error?: { message?: string } };
    if (!igRes.ok || me.error) {
      throw new Error(me.error?.message || "Token inválido ou sem permissão para acessar a conta Instagram.");
    }
    if (!me.id) throw new Error("Token inválido ou sem permissão para acessar a conta Instagram.");
    return {
      instagramAccountId: String(me.id),
      pageId: "",
      username: String(me.username || me.name || ""),
      displayName: String(me.name || me.username || "Instagram"),
      avatarUrl: String(me.profile_picture_url || "")
    };
  }

  // Fluxo Facebook User Token → busca Pages → Instagram Business Account vinculado
  try {
    const pages = await graphGet<PageResponse>("/me/accounts", accessToken, {
      fields: "id,name,instagram_business_account{id,username,profile_picture_url}"
    });
    const page = pages.data?.find((item) => item.instagram_business_account?.id);
    if (page?.instagram_business_account?.id) {
      const account = page.instagram_business_account;
      return {
        instagramAccountId: String(account.id),
        pageId: String(page.id || ""),
        username: String(account.username || ""),
        displayName: String(page.name || account.username || "Instagram"),
        avatarUrl: String(account.profile_picture_url || "")
      };
    }
  } catch {
    // Fallback: tenta /me direto
  }

  const me = await graphGet<MeResponse>("/me", accessToken, {
    fields: "id,username,name,profile_picture_url"
  });
  if (!me.id) throw new Error("Token inválido ou sem permissão para acessar a conta Instagram.");
  return {
    instagramAccountId: String(me.id),
    pageId: "",
    username: String(me.username || me.name || ""),
    displayName: String(me.name || me.username || "Instagram"),
    avatarUrl: String(me.profile_picture_url || "")
  };
}

/** Remove lone surrogates que o PostgreSQL rejeita como JSON inválido.
 *  Chrome serializa \uD800 como JSON válido, mas o PostgreSQL não aceita ao parsear o request body. */
function sanitizeText(s: string): string {
  // [...s] divide por code points — pares válidos viram 1 elemento com cp > 0xFFFF,
  // lone surrogates ficam como 1 elemento com cp entre 0xD800–0xDFFF e são removidos.
  return [...s].filter((c) => {
    const cp = c.codePointAt(0) ?? 0;
    return cp < 0xD800 || cp > 0xDFFF;
  }).join("");
}

function normalizeMedia(item: any): InstagramMediaItem {
  return {
    id: String(item.id || ""),
    caption: sanitizeText(String(item.caption || "")),
    mediaType: String(item.media_type || ""),
    mediaUrl: String(item.media_url || ""),
    thumbnailUrl: String(item.thumbnail_url || item.media_url || ""),
    permalink: String(item.permalink || ""),
    timestamp: String(item.timestamp || ""),
    likeCount: Number(item.like_count || 0),
    commentsCount: Number(item.comments_count || 0)
  };
}

function normalizeInstagramUsername(value: unknown): string {
  return sanitizeText(String(value ?? "")).replace(/^@+/, "").toLowerCase();
}

function normalizeInstagramCommentText(value: unknown): string {
  return sanitizeText(String(value ?? "")).toLowerCase().replace(/\s+/g, " ").trim();
}

export async function fetchInstagramMedia(
  accessToken: string,
  instagramAccountId: string,
  options: { maxMedia?: number; maxPages?: number; since?: Date } = {}
) {
  const maxMedia = options.maxMedia ?? 1000;
  const maxPages = options.maxPages ?? 50;
  const media: InstagramMediaItem[] = [];
  let nextUrl = `${igApiBase(accessToken)}/${instagramAccountId}/media?fields=${encodeURIComponent("id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count")}&limit=100`;
  let pages = 0;
  while (nextUrl && pages < maxPages && media.length < maxMedia) {
    const data = await graphGet<{ data?: any[]; paging?: { next?: string } }>(nextUrl, accessToken);
    const pageItems = (data.data ?? []).map(normalizeMedia).filter((item) => item.id);
    for (const item of pageItems) {
      const timestamp = item.timestamp ? new Date(item.timestamp) : null;
      if (options.since && timestamp && !Number.isNaN(timestamp.getTime()) && timestamp < options.since) {
        nextUrl = "";
        break;
      }
      media.push(item);
      if (media.length >= maxMedia) break;
    }
    if (!nextUrl) break;
    nextUrl = data.paging?.next || "";
    pages += 1;
  }
  return media.slice(0, maxMedia);
}

export async function fetchInstagramCommentsForMedia(
  accessToken: string,
  media: InstagramMediaItem,
  options: { since?: Date; maxComments?: number; maxPages?: number; ownUsername?: string; ownAccountId?: string } = {}
) {
  const maxComments = options.maxComments ?? 1000;
  const maxPages = options.maxPages ?? 20;
  const comments: InstagramCommentItem[] = [];
  let nextUrl = `${igApiBase(accessToken)}/${media.id}/comments?fields=${encodeURIComponent("id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}")}&limit=100`;
  let pages = 0;
  const videoTitle = media.caption?.slice(0, 140) || "Post Instagram";
  const ownUsername = normalizeInstagramUsername(options.ownUsername);
  const ownAccountId = sanitizeText(options.ownAccountId ?? "");

  while (nextUrl && pages < maxPages && comments.length < maxComments) {
    const data = await graphGet<{ data?: any[]; paging?: { next?: string } }>(nextUrl, accessToken);
    for (const item of data.data ?? []) {
      const publishedAt = String(item.timestamp || media.timestamp || new Date().toISOString());
      const publishedDate = publishedAt ? new Date(publishedAt) : null;
      if (options.since && publishedDate && !Number.isNaN(publishedDate.getTime()) && publishedDate < options.since) {
        continue;
      }
      const replies = Array.isArray(item.replies?.data) ? item.replies.data : [];
      const mappedReplies: InstagramCommentReplyItem[] = replies.map((reply: any): InstagramCommentReplyItem => {
        const authorName = sanitizeText(String(reply.username || "Instagram"));
        const replyId = String(reply.id || "");
        const isOwnReply = Boolean(
          (ownUsername && normalizeInstagramUsername(authorName) === ownUsername) ||
          (ownAccountId && String(reply.from?.id || reply.owner?.id || "") === ownAccountId)
        );
        return {
          id: replyId,
          authorName,
          text: sanitizeText(String(reply.text || "")),
          publishedAt: String(reply.timestamp || publishedAt),
          likes: Number(reply.like_count || 0),
          isOwnReply
        };
      }).filter((reply: InstagramCommentReplyItem) => Boolean(reply.id && reply.text));
      const channelReply = mappedReplies
        .filter((reply) => reply.isOwnReply)
        .map((reply) => reply.text)
        .filter(Boolean)
        .join("\n\n") || undefined;
      const externalReplies = mappedReplies.filter((reply) => !reply.isOwnReply);
      comments.push({
        commentId: `instagram:${String(item.id || "")}`,
        videoId: media.id,
        videoTitle: sanitizeText(videoTitle),
        mediaThumbnailUrl: media.thumbnailUrl || media.mediaUrl || undefined,
        mediaUrl: media.mediaUrl || undefined,
        mediaPermalink: media.permalink || undefined,
        authorName: sanitizeText(String(item.username || "Instagram")),
        text: sanitizeText(String(item.text || "")),
        likes: Number(item.like_count || 0),
        publishedAt,
        externalReplies,
        channelReply
      });
      if (comments.length >= maxComments) break;
    }
    nextUrl = data.paging?.next || "";
    pages += 1;
  }
  return comments.filter((item) => item.commentId && item.text);
}

export async function fetchInstagramCommentById(accessToken: string, commentId: string, fallbackMediaId = "") {
  const cleanId = commentId.replace(/^instagram:/, "");
  const data = await graphGet<any>(`${igApiBase(accessToken)}/${cleanId}`, accessToken, {
    fields: "id,text,username,timestamp,like_count,media{id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}"
  });
  const media = data?.media ?? {};
  const mediaId = String(media.id || fallbackMediaId || "");
  const normalizedMedia = mediaId ? normalizeMedia({ id: mediaId, ...media }) : null;
  return {
    commentId: `instagram:${String(data.id || cleanId)}`,
    videoId: mediaId,
    videoTitle: sanitizeText(String(media.caption || "Post Instagram")).slice(0, 140) || "Post Instagram",
    mediaThumbnailUrl: normalizedMedia?.thumbnailUrl || normalizedMedia?.mediaUrl || undefined,
    mediaUrl: normalizedMedia?.mediaUrl || undefined,
    mediaPermalink: normalizedMedia?.permalink || undefined,
    authorName: sanitizeText(String(data.username || "Instagram")),
    text: sanitizeText(String(data.text || "")),
    likes: Number(data.like_count || 0),
    publishedAt: String(data.timestamp || media.timestamp || new Date().toISOString())
  } satisfies InstagramCommentItem;
}

export async function validateInstagramComment(accessToken: string, commentId: string) {
  const cleanId = commentId.replace(/^instagram:/, "").trim();
  if (!cleanId) throw new Error("Comentario Instagram sem ID externo.");
  return graphGet<any>(`${igApiBase(accessToken)}/${cleanId}`, accessToken, {
    fields: "id,text,username,timestamp,like_count,media{id}"
  });
}

export async function findInstagramCommentOnMedia(
  accessToken: string,
  mediaId: string,
  target: { authorName?: string; text?: string },
  options: { maxPages?: number } = {}
) {
  const cleanMediaId = mediaId.replace(/^instagram:/, "").trim();
  if (!cleanMediaId) return null;

  const targetAuthor = normalizeInstagramUsername(target.authorName);
  const targetText = normalizeInstagramCommentText(target.text);
  if (!targetText) return null;

  const maxPages = options.maxPages ?? 3;
  let pages = 0;
  let nextUrl = `${igApiBase(accessToken)}/${cleanMediaId}/comments?fields=${encodeURIComponent("id,text,username,timestamp,like_count")}&limit=100`;

  while (nextUrl && pages < maxPages) {
    const data = await graphGet<{ data?: any[]; paging?: { next?: string } }>(nextUrl, accessToken);
    for (const item of data.data ?? []) {
      const itemText = normalizeInstagramCommentText(item.text);
      const itemAuthor = normalizeInstagramUsername(item.username);
      const authorMatches = !targetAuthor || itemAuthor === targetAuthor;
      if (authorMatches && itemText === targetText && item.id) {
        return {
          id: String(item.id),
          text: sanitizeText(String(item.text || "")),
          username: sanitizeText(String(item.username || "Instagram")),
          timestamp: String(item.timestamp || ""),
          likes: Number(item.like_count || 0)
        };
      }
    }
    nextUrl = data.paging?.next || "";
    pages += 1;
  }

  return null;
}

export async function fetchInstagramMediaById(accessToken: string, mediaId: string): Promise<InstagramMediaItem | null> {
  const cleanId = mediaId.replace(/^instagram:/, "").trim();
  if (!cleanId) return null;
  try {
    const data = await graphGet<any>(`${igApiBase(accessToken)}/${cleanId}`, accessToken, {
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count"
    });
    return normalizeMedia(data);
  } catch {
    return null;
  }
}

export async function replyToInstagramComment(accessToken: string, commentId: string, message: string) {
  const cleanId = commentId.replace(/^instagram:/, "");
  return graphPost<{ id?: string }>(`${igApiBase(accessToken)}/${cleanId}/replies`, accessToken, {
    message
  });
}

export async function likeInstagramComment(accessToken: string, commentId: string) {
  const cleanId = commentId.replace(/^instagram:/, "");
  return graphPost<{ success?: boolean }>(`${igApiBase(accessToken)}/${cleanId}/likes`, accessToken, {});
}

export async function fetchInstagramInsightsForMedia(accessToken: string, media: InstagramMediaItem) {
  const metrics = ["reach", "impressions", "views", "shares", "saved", "total_interactions"].join(",");
  try {
    const data = await graphGet<{ data?: Array<{ name?: string; values?: Array<{ value?: number }> }> }>(`${igApiBase(accessToken)}/${media.id}/insights`, accessToken, { metric: metrics });
    const values = new Map<string, number>();
    for (const item of data.data ?? []) {
      values.set(String(item.name || ""), Number(item.values?.[0]?.value || 0));
    }
    return {
      reach: values.get("reach") || 0,
      impressions: values.get("impressions") || 0,
      views: values.get("views") || 0,
      shares: values.get("shares") || 0,
      saved: values.get("saved") || 0,
      totalInteractions: values.get("total_interactions") || 0
    };
  } catch {
    return { reach: 0, impressions: 0, views: 0, shares: 0, saved: 0, totalInteractions: 0 };
  }
}
