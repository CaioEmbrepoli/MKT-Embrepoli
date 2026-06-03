import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createMetricAfterPublish(
  service: SupabaseClient,
  params: {
    organizationId: string;
    platform: string;
    externalId: string;
    postId?: string | null;
    postTitle?: string | null;
    permalink?: string | null;
    publishedAt: string;
    format?: string | null;
  }
) {
  const { data: byId } = await service
    .from("channels")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("id", params.platform)
    .maybeSingle();

  let channelId = byId?.id as string | undefined;
  if (!channelId) {
    const { data: byName } = await service
      .from("channels")
      .select("id")
      .eq("organization_id", params.organizationId)
      .ilike("name", `%${params.platform}%`)
      .maybeSingle();
    channelId = (byName?.id as string | undefined) ?? params.platform;
  }

  const fmt = (params.format ?? "").toLowerCase();
  let videoType: "video" | "short" | null = null;
  if (params.platform === "youtube") {
    videoType = fmt.includes("short") ? "short" : "video";
  } else if (params.platform === "tiktok") {
    videoType = "short";
  } else if (params.platform === "instagram") {
    videoType = fmt === "reels" || fmt === "story" ? "short" : null;
  }

  // Se já existe uma métrica com o mesmo post_id mas sem external_id (criada manualmente
  // antes da publicação), vincula o external_id a ela em vez de criar um registro novo.
  if (params.postId) {
    const { data: existingByPost } = await service
      .from("post_metrics")
      .select("id")
      .eq("organization_id", params.organizationId)
      .eq("post_id", params.postId)
      .is("external_id", null)
      .maybeSingle();

    if (existingByPost?.id) {
      await service
        .from("post_metrics")
        .update({
          external_id: params.externalId,
          source_url: params.permalink ?? null,
          embed_url: params.permalink ?? null,
          metric_date: params.publishedAt.slice(0, 10),
          video_type: videoType,
          privacy_status: "public",
        })
        .eq("id", existingByPost.id);
      return;
    }
  }

  await service
    .from("post_metrics")
    .upsert(
      {
        id: crypto.randomUUID(),
        organization_id: params.organizationId,
        external_id: params.externalId,
        post_id: params.postId ?? null,
        post_title: params.postTitle || "Post publicado",
        channel_id: channelId,
        metric_date: params.publishedAt.slice(0, 10),
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        leads: 0,
        notes: "",
        learning: "",
        video_type: videoType,
        privacy_status: "public",
        source_url: params.permalink ?? null,
        embed_url: params.permalink ?? null,
      },
      { onConflict: "external_id", ignoreDuplicates: true }
    );
}
