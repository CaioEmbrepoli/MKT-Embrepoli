import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext, type GoogleRequestContext } from "@/lib/google-server";
import { parseSaoPauloDateTime } from "@/lib/app-time";
import { syncPostStatusFromPublications } from "@/lib/post-status-server";

export const dynamic = "force-dynamic";

const activeStatuses = ["scheduled", "pending", "processing"];
const MIN_FUTURE_MS = 2 * 60 * 1000;

type PublicationRow = {
  id: string;
  post_id: string | null;
  platform: string;
  status: string;
  external_id: string | null;
  scheduled_at: string | null;
};

type YouTubeVideoItem = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    categoryId?: string;
    tags?: string[];
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
  };
  status?: {
    privacyStatus?: string;
    publishAt?: string;
    selfDeclaredMadeForKids?: boolean;
    license?: string;
    embeddable?: boolean;
    publicStatsViewable?: boolean;
  };
};

async function updateYouTubeSchedule(context: GoogleRequestContext, videoId: string, scheduledIso: string) {
  const accessToken = await getGoogleAccessToken(context, "youtube");
  const getResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${encodeURIComponent(videoId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const getData = await getResponse.json().catch(() => ({})) as { items?: YouTubeVideoItem[]; error?: { message?: string } };
  if (!getResponse.ok) {
    throw new Error(getData.error?.message ?? "Nao foi possivel carregar o video agendado do YouTube.");
  }
  const video = getData.items?.[0];
  if (!video?.snippet) throw new Error("Video agendado do YouTube nao encontrado.");

  const updateResponse = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet,status", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: video.id,
      snippet: {
        title: video.snippet.title ?? "",
        description: video.snippet.description ?? "",
        categoryId: video.snippet.categoryId ?? "22",
        tags: video.snippet.tags,
        defaultLanguage: video.snippet.defaultLanguage,
        defaultAudioLanguage: video.snippet.defaultAudioLanguage
      },
      status: {
        privacyStatus: "private",
        publishAt: scheduledIso,
        selfDeclaredMadeForKids: video.status?.selfDeclaredMadeForKids ?? false,
        license: video.status?.license,
        embeddable: video.status?.embeddable,
        publicStatsViewable: video.status?.publicStatsViewable
      }
    })
  });
  const updateData = await updateResponse.json().catch(() => ({})) as { error?: { message?: string } };
  if (!updateResponse.ok) {
    throw new Error(updateData.error?.message ?? "Nao foi possivel reagendar o video no YouTube.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const body = await request.json().catch(() => ({})) as { postId?: string; publishAt?: string };
    const postId = body.postId?.trim();
    const publishAt = body.publishAt?.trim();
    if (!postId || !publishAt) {
      return NextResponse.json({ error: "postId e publishAt sao obrigatorios." }, { status: 400 });
    }

    const scheduledDate = parseSaoPauloDateTime(publishAt);
    if (!scheduledDate) {
      return NextResponse.json({ error: "Data de agendamento invalida." }, { status: 400 });
    }
    if (scheduledDate.getTime() <= Date.now() + MIN_FUTURE_MS) {
      return NextResponse.json({ error: "Escolha uma data e horario com pelo menos 2 minutos de antecedencia para reagendar publicacoes ativas." }, { status: 400 });
    }
    const scheduledIso = scheduledDate.toISOString();

    const { data: post, error: postError } = await context.service
      .from("posts")
      .select("id")
      .eq("organization_id", context.organizationId)
      .eq("id", postId)
      .maybeSingle();
    if (postError) throw new Error(postError.message);
    if (!post) return NextResponse.json({ error: "Post nao encontrado." }, { status: 404 });

    const { data: publications, error: publicationsError } = await context.service
      .from("post_publications")
      .select("id,post_id,platform,status,external_id,scheduled_at")
      .eq("organization_id", context.organizationId)
      .eq("post_id", postId)
      .in("status", activeStatuses);
    if (publicationsError) throw new Error(publicationsError.message);

    const rows = (publications ?? []) as PublicationRow[];
    for (const publication of rows) {
      if (publication.platform === "youtube" && publication.external_id) {
        await updateYouTubeSchedule(context, publication.external_id, scheduledIso);
      }
    }

    const now = new Date().toISOString();
    const { error: postUpdateError } = await context.service
      .from("posts")
      .update({ publish_at: publishAt })
      .eq("organization_id", context.organizationId)
      .eq("id", postId);
    if (postUpdateError) throw new Error(postUpdateError.message);

    const publicationIds = rows.map((publication) => publication.id);
    if (publicationIds.length) {
      const { error: publicationUpdateError } = await context.service
        .from("post_publications")
        .update({
          scheduled_at: scheduledIso,
          next_attempt_at: scheduledIso,
          updated_at: now
        })
        .eq("organization_id", context.organizationId)
        .eq("post_id", postId)
        .in("id", publicationIds);
      if (publicationUpdateError) throw new Error(publicationUpdateError.message);

      const { error: queueUpdateError } = await context.service
        .from("youtube_upload_queue")
        .update({ scheduled_at: scheduledIso, updated_at: now })
        .eq("organization_id", context.organizationId)
        .eq("post_id", postId)
        .in("post_publication_id", publicationIds);
      if (queueUpdateError) throw new Error(queueUpdateError.message);
    }

    await syncPostStatusFromPublications(context.service, {
      organizationId: context.organizationId,
      postId
    });

    return NextResponse.json({
      ok: true,
      postId,
      publishAt,
      scheduledAt: scheduledIso,
      publicationIds,
      updatedPublications: publicationIds.length
    });
  } catch (error) {
    console.error("[post-publications/reschedule]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar agendamento." },
      { status: 500 }
    );
  }
}
