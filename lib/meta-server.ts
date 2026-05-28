import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type MetaService = "instagram";

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_manage_comments",
  "instagram_business_manage_messages"
];

type MetaConnectionRow = {
  id: string;
  organization_id: string;
  service: MetaService;
  instagram_account_id: string;
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
  authorName: string;
  text: string;
  likes: number;
  publishedAt: string;
  channelReply?: string;
};

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

export async function getInstagramConnection(context: MetaRequestContext) {
  const connection = await getMetaConnection(context.service, context.organizationId, "instagram");
  if (!connection?.access_token || !connection.instagram_account_id) {
    throw new Error("Instagram / Meta nao conectado. Cadastre o token em Conta e Permissoes.");
  }
  if (connection.expires_at && new Date(connection.expires_at).getTime() < Date.now()) {
    throw new Error("Token do Instagram expirado. Gere um novo token no Meta Developer e atualize a conexao.");
  }
  return connection;
}

async function graphGet<T>(pathOrUrl: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
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

export async function fetchInstagramMedia(accessToken: string, instagramAccountId: string) {
  const media: InstagramMediaItem[] = [];
  let nextUrl = `${igApiBase(accessToken)}/${instagramAccountId}/media?fields=${encodeURIComponent("id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count")}&limit=100`;
  let pages = 0;
  while (nextUrl && pages < 50 && media.length < 1000) {
    const data = await graphGet<{ data?: any[]; paging?: { next?: string } }>(nextUrl, accessToken);
    media.push(...(data.data ?? []).map(normalizeMedia).filter((item) => item.id));
    nextUrl = data.paging?.next || "";
    pages += 1;
  }
  return media.slice(0, 1000);
}

export async function fetchInstagramCommentsForMedia(accessToken: string, media: InstagramMediaItem) {
  const comments: InstagramCommentItem[] = [];
  let nextUrl = `${igApiBase(accessToken)}/${media.id}/comments?fields=${encodeURIComponent("id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}")}&limit=100`;
  let pages = 0;
  const videoTitle = media.caption?.slice(0, 140) || "Post Instagram";

  while (nextUrl && pages < 20 && comments.length < 1000) {
    const data = await graphGet<{ data?: any[]; paging?: { next?: string } }>(nextUrl, accessToken);
    for (const item of data.data ?? []) {
      const replies = Array.isArray(item.replies?.data) ? item.replies.data : [];
      const channelReply = replies.map((reply: any) => sanitizeText(String(reply.text || ""))).filter(Boolean).join("\n\n") || undefined;
      comments.push({
        commentId: `instagram:${String(item.id || "")}`,
        videoId: media.id,
        videoTitle: sanitizeText(videoTitle),
        authorName: sanitizeText(String(item.username || "Instagram")),
        text: sanitizeText(String(item.text || "")),
        likes: Number(item.like_count || 0),
        publishedAt: String(item.timestamp || media.timestamp || new Date().toISOString()),
        channelReply
      });
    }
    nextUrl = data.paging?.next || "";
    pages += 1;
  }
  return comments.filter((item) => item.commentId && item.text);
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
