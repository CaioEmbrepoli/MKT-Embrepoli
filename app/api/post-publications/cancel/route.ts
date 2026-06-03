import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext, type GoogleRequestContext } from "@/lib/google-server";
import { getMetaConnection, metaGraphVersion } from "@/lib/meta-server";

export const dynamic = "force-dynamic";

type PublicationRow = {
  id: string;
  organization_id: string;
  post_id: string | null;
  platform: string;
  status: string;
  external_id: string | null;
  format: string | null;
};

type ReviewAssetRow = {
  status: string | null;
  is_cover: boolean | null;
};

const cancellableStatuses = new Set(["scheduled", "pending", "processing", "error"]);
const activeStatuses = ["scheduled", "pending", "processing"];

async function cancelYoutubePublication(context: GoogleRequestContext, publication: PublicationRow) {
  if (!publication.external_id) return;

  const accessToken = await getGoogleAccessToken(context, "youtube");
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(publication.external_id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (response.ok || response.status === 404) return;

  const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
  throw new Error(data.error?.message ?? "Nao foi possivel remover o video agendado do YouTube.");
}

async function cancelInstagramPublication(context: GoogleRequestContext, publication: PublicationRow) {
  if (!publication.external_id) return;

  const connection = await getMetaConnection(context.service, context.organizationId, "instagram");
  if (!connection?.access_token) throw new Error("Instagram / Meta nao conectado.");

  const response = await fetch(
    `https://graph.facebook.com/${metaGraphVersion()}/${encodeURIComponent(publication.external_id)}?access_token=${encodeURIComponent(connection.access_token)}`,
    { method: "DELETE" }
  );
  const data = await response.json().catch(() => ({})) as { success?: boolean; error?: { message?: string } };

  if (response.ok && data.error == null) return;
  throw new Error(data.error?.message ?? "A Meta nao permitiu cancelar esta publicacao agendada.");
}

function statusFromReviewAssets(assets: ReviewAssetRow[]) {
  const visibleAssets = assets.filter((asset) => !asset.is_cover);
  if (visibleAssets.some((asset) => asset.status === "Aprovado")) return "Aprovado";
  if (visibleAssets.some((asset) => asset.status === "Aguardando revisão" || asset.status === "Ajustes solicitados")) return "Revisão";
  return "Produção";
}

async function restorePostStatusIfNeeded(context: GoogleRequestContext, postId: string | null) {
  if (!postId) return null;

  const { data: post, error: postError } = await context.service
    .from("posts")
    .select("id,status")
    .eq("organization_id", context.organizationId)
    .eq("id", postId)
    .maybeSingle();
  if (postError) throw new Error(postError.message);
  if (!post || post.status !== "Agendado") return null;

  const { data: publications, error: publicationsError } = await context.service
    .from("post_publications")
    .select("id,status")
    .eq("organization_id", context.organizationId)
    .eq("post_id", postId)
    .neq("status", "cancelled");
  if (publicationsError) throw new Error(publicationsError.message);

  const remaining = publications ?? [];
  if (remaining.some((publication) => activeStatuses.includes(publication.status))) return null;

  const nextStatus = remaining.some((publication) => publication.status === "published")
    ? "Publicado"
    : await resolveReviewBasedPostStatus(context, postId);

  const { error: updateError } = await context.service
    .from("posts")
    .update({ status: nextStatus })
    .eq("organization_id", context.organizationId)
    .eq("id", postId);
  if (updateError) throw new Error(updateError.message);

  return nextStatus;
}

async function resolveReviewBasedPostStatus(context: GoogleRequestContext, postId: string) {
  const { data: assets, error } = await context.service
    .from("post_review_assets")
    .select("status,is_cover")
    .eq("organization_id", context.organizationId)
    .eq("post_id", postId);
  if (error) throw new Error(error.message);
  return statusFromReviewAssets((assets ?? []) as ReviewAssetRow[]);
}

export async function POST(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const body = await request.json().catch(() => ({})) as { publicationId?: string };
    const publicationId = body.publicationId?.trim();
    if (!publicationId) {
      return NextResponse.json({ error: "publicationId obrigatorio." }, { status: 400 });
    }

    const { data: publication, error } = await context.service
      .from("post_publications")
      .select("id,organization_id,post_id,platform,status,external_id,format")
      .eq("organization_id", context.organizationId)
      .eq("id", publicationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!publication) {
      return NextResponse.json({ error: "Publicacao nao encontrada." }, { status: 404 });
    }

    const typedPublication = publication as PublicationRow;
    if (typedPublication.status === "published") {
      return NextResponse.json({ error: "Publicacoes ja publicadas nao podem ser canceladas por aqui." }, { status: 409 });
    }
    if (typedPublication.status === "cancelled") {
      return NextResponse.json({ ok: true, status: "cancelled" });
    }
    if (!cancellableStatuses.has(typedPublication.status)) {
      return NextResponse.json({ error: "Esta publicacao nao esta em um estado cancelavel." }, { status: 409 });
    }

    if (typedPublication.platform === "youtube") {
      await cancelYoutubePublication(context, typedPublication);
    } else if (typedPublication.platform === "instagram") {
      await cancelInstagramPublication(context, typedPublication);
    } else if (typedPublication.platform === "tiktok" && typedPublication.external_id && typedPublication.status !== "scheduled") {
      return NextResponse.json(
        { error: "Esta publicacao do TikTok ja foi enviada ao canal e nao pode ser cancelada pelo sistema." },
        { status: 409 }
      );
    }

    const { error: updateError } = await context.service
      .from("post_publications")
      .update({ status: "cancelled", error: null, updated_at: new Date().toISOString() })
      .eq("organization_id", context.organizationId)
      .eq("id", typedPublication.id);
    if (updateError) throw new Error(updateError.message);

    const postStatus = await restorePostStatusIfNeeded(context, typedPublication.post_id);
    return NextResponse.json({ ok: true, status: "cancelled", postStatus });
  } catch (error) {
    console.error("[post-publications/cancel]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao cancelar agendamento." },
      { status: 500 }
    );
  }
}
