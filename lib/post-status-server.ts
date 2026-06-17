import type { SupabaseClient } from "@supabase/supabase-js";
import { derivePostStatusFromPublications } from "./post-publication-status";
import type { PostPublication, PostStatus } from "./types";

export async function syncPostStatusFromPublications(
  service: SupabaseClient,
  {
    organizationId,
    postId,
    publishedAt
  }: {
    organizationId: string;
    postId?: string | null;
    publishedAt?: string | null;
  }
) {
  if (!postId) return null;

  const { data: post, error: postError } = await service
    .from("posts")
    .select("id,status,published_at")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .maybeSingle();
  if (postError || !post) return null;

  const { data: publications, error: publicationsError } = await service
    .from("post_publications")
    .select("status")
    .eq("organization_id", organizationId)
    .eq("post_id", postId);
  if (publicationsError) return null;

  const nextStatus = derivePostStatusFromPublications(
    String(post.status || "Produção") as PostStatus,
    (publications ?? []) as Pick<PostPublication, "status">[]
  );

  const update: Record<string, string> = {};
  if (nextStatus !== post.status) update.status = nextStatus;
  if (nextStatus === "Publicado" && publishedAt && !post.published_at) update.published_at = publishedAt;

  if (Object.keys(update).length > 0) {
    await service
      .from("posts")
      .update(update)
      .eq("organization_id", organizationId)
      .eq("id", postId);
  }

  return nextStatus;
}
