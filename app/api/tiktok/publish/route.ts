import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/google-server";
import { syncPostStatusFromPublications } from "@/lib/post-status-server";
import { recordDiagnostic } from "@/lib/api-errors";
import { getTikTokAccessToken, tiktokRequestContext } from "@/lib/tiktok-server";

function extractDriveFileId(url: string): string | null {
  return url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]
    ?? null;
}

async function inspectAsset(
  context: Awaited<ReturnType<typeof tiktokRequestContext>>,
  assetUrl: string,
) {
  const driveFileId = extractDriveFileId(assetUrl);
  if (driveFileId) {
    const driveToken = await getGoogleAccessToken(context, "drive");
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=size,mimeType`,
      { headers: { Authorization: `Bearer ${driveToken}` } },
    );
    const data = await response.json().catch(() => ({})) as { size?: string; mimeType?: string; error?: { message?: string } };
    const fileSize = Number(data.size ?? 0);
    if (!response.ok || !Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error(data.error?.message ?? "Nao foi possivel identificar o tamanho do video no Google Drive.");
    }
    return { fileSize, contentType: data.mimeType || "video/mp4" };
  }

  const response = await fetch(assetUrl, { method: "HEAD", redirect: "follow" });
  const fileSize = Number(response.headers.get("content-length") ?? 0);
  if (!response.ok || !Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("O TikTok precisa de uma URL de video com tamanho conhecido. Use um arquivo do Google Drive ou uma URL publica que informe Content-Length.");
  }
  return { fileSize, contentType: response.headers.get("content-type")?.split(";")[0] || "video/mp4" };
}

export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof tiktokRequestContext>> | null = null;
  let postId = "";
  try {
    context = await tiktokRequestContext(request);
    await getTikTokAccessToken(context);

    const body = await request.json() as {
      assetUrl?: string;
      title?: string;
      description?: string;
      format?: string;
      scheduledAt?: string | null;
      privacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
      postId?: string;
      allowDuplicate?: boolean;
    };
    const assetUrl = body.assetUrl?.trim() ?? "";
    const title = body.title?.trim() ?? "";
    postId = body.postId?.trim() ?? "";
    if (!assetUrl || !title || !postId) {
      return NextResponse.json({ error: "assetUrl, title e postId sao obrigatorios." }, { status: 400 });
    }

    if (!body.allowDuplicate) {
      const { data: existing } = await context.service
        .from("post_publications")
        .select("id")
        .eq("organization_id", context.organizationId)
        .eq("post_id", postId)
        .eq("platform", "tiktok")
        .in("status", ["pending", "processing", "published", "scheduled"])
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: "Este post ja tem uma publicacao registrada no TikTok. Confirme a republicacao para continuar." }, { status: 409 });
      }
    }

    const metadata = await inspectAsset(context, assetUrl);
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt).toISOString() : null;
    const now = new Date().toISOString();
    const publicationId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    const { error: publicationError } = await context.service.from("post_publications").insert({
      id: publicationId,
      organization_id: context.organizationId,
      post_id: postId,
      platform: "tiktok",
      status: "pending",
      title,
      caption: body.description ?? "",
      format: body.format ?? "Video",
      asset_url: assetUrl,
      scheduled_at: scheduledAt,
      created_by: context.userId,
      created_at: now,
      updated_at: now,
    });
    if (publicationError) throw publicationError;

    const { error: queueError } = await context.service.from("tiktok_upload_queue").insert({
      id: jobId,
      organization_id: context.organizationId,
      post_id: postId,
      post_publication_id: publicationId,
      created_by: context.userId,
      asset_url: assetUrl,
      title,
      description: body.description ?? "",
      format: body.format ?? "Video",
      privacy_level: body.privacyLevel ?? "PUBLIC_TO_EVERYONE",
      scheduled_at: scheduledAt,
      status: "pending",
      file_size: metadata.fileSize,
      content_type: metadata.contentType,
      created_at: now,
      updated_at: now,
    });
    if (queueError) throw queueError;

    await syncPostStatusFromPublications(context.service, { organizationId: context.organizationId, postId });
    return NextResponse.json({ queued: true, jobId, publicationId, fileSize: metadata.fileSize, contentType: metadata.contentType });
  } catch (error) {
    if (context) {
      await recordDiagnostic(context.service, {
        organizationId: context.organizationId,
        provider: "tiktok",
        service: "tiktok",
        error,
        category: "fila",
        severity: "erro",
        eventKey: `fila:tiktok:criar:${postId || "sem-post"}`,
        title: "Falha ao criar fila de upload do TikTok",
        profileId: context.userId,
        targetKind: "post",
        targetId: postId || undefined,
      }).catch(() => undefined);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao enfileirar upload no TikTok." }, { status: 400 });
  }
}
