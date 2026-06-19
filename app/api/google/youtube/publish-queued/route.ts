import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";
import { parseSaoPauloDateTime } from "@/lib/app-time";
import { syncPostStatusFromPublications } from "@/lib/post-status-server";
import { recordDiagnostic } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

async function resolveAssetMetadata(assetUrl: string, driveToken: string) {
  const driveFileId = extractDriveFileId(assetUrl);
  if (driveFileId) {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=size,mimeType,name`,
      { headers: { Authorization: `Bearer ${driveToken}` } }
    );
    const meta = await metaRes.json().catch(() => ({})) as { size?: string; mimeType?: string; name?: string; error?: { message?: string } };
    if (!metaRes.ok) {
      throw new Error(meta.error?.message || "Nao foi possivel ler o arquivo no Google Drive.");
    }
    return {
      fileSize: Number(meta.size || 0),
      contentType: String(meta.mimeType || "video/mp4"),
      fileName: String(meta.name || "")
    };
  }

  const headRes = await fetch(assetUrl, { method: "HEAD" });
  if (!headRes.ok) throw new Error("Nao foi possivel acessar o arquivo de midia.");
  return {
    fileSize: Number(headRes.headers.get("content-length") || 0),
    contentType: headRes.headers.get("content-type") || "video/mp4",
    fileName: ""
  };
}

export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof googleRequestContext>> | null = null;
  let postId = "";
  try {
    context = await googleRequestContext(request);
    const [ytToken, driveToken] = await Promise.all([
      getGoogleAccessToken(context, "youtube"),
      getGoogleAccessToken(context, "drive")
    ]);
    void ytToken;

    const body = await request.json() as {
      assetUrl: string;
      title: string;
      description: string;
      format: string;
      scheduledAt?: string | null;
      thumbnailUrl?: string | null;
      postId?: string;
      allowDuplicate?: boolean;
    };
    postId = body.postId ?? "";

    const { assetUrl, title, description, format, scheduledAt, thumbnailUrl } = body;
    if (!assetUrl || !title) {
      return NextResponse.json({ error: "assetUrl e title sao obrigatorios." }, { status: 400 });
    }

    const scheduledDate = scheduledAt ? parseSaoPauloDateTime(scheduledAt) : null;
    const scheduledIso = scheduledDate ? scheduledDate.toISOString() : null;

    if (body.postId && !body.allowDuplicate) {
      const { data: existingPublication } = await context.service
        .from("post_publications")
        .select("id,status")
        .eq("organization_id", context.organizationId)
        .eq("post_id", body.postId)
        .eq("platform", "youtube")
        .in("status", ["pending", "processing", "published", "scheduled"])
        .limit(1)
        .maybeSingle();

      if (existingPublication) {
        return NextResponse.json(
          { error: "Este post ja tem publicacao registrada no YouTube. Desative o canal ou confirme republicacao para continuar." },
          { status: 409 }
        );
      }

      const { data: existingQueue } = await context.service
        .from("youtube_upload_queue")
        .select("id,status")
        .eq("organization_id", context.organizationId)
        .eq("post_id", body.postId)
        .in("status", ["pending", "processing", "uploaded"])
        .limit(1)
        .maybeSingle();

      if (existingQueue) {
        return NextResponse.json(
          { error: "Este post ja tem upload em fila para o YouTube. Confirme republicacao para criar outro." },
          { status: 409 }
        );
      }
    }

    const metadata = await resolveAssetMetadata(assetUrl, driveToken);
    if (!metadata.contentType.startsWith("video/")) {
      return NextResponse.json({ error: "O upload em fila do YouTube aceita apenas arquivos de video." }, { status: 400 });
    }
    if (!metadata.fileSize || metadata.fileSize <= 0) {
      return NextResponse.json({ error: "Nao foi possivel identificar o tamanho do video para upload resumable." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const publicationId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    const { error: publicationError } = await context.service.from("post_publications").insert({
      id: publicationId,
      organization_id: context.organizationId,
      post_id: body.postId ?? null,
      platform: "youtube",
      status: "pending",
      title,
      caption: description ?? "",
      format: format ?? "video",
      asset_url: assetUrl,
      thumbnail_url: thumbnailUrl ?? null,
      scheduled_at: scheduledIso,
      created_by: context.userId,
      created_at: now,
      updated_at: now
    });
    if (publicationError) throw publicationError;

    const { error: queueError } = await context.service.from("youtube_upload_queue").insert({
      id: jobId,
      organization_id: context.organizationId,
      post_id: body.postId ?? null,
      post_publication_id: publicationId,
      created_by: context.userId,
      asset_url: assetUrl,
      title,
      description: description ?? "",
      format: format ?? "video",
      scheduled_at: scheduledIso,
      thumbnail_url: thumbnailUrl ?? null,
      allow_duplicate: Boolean(body.allowDuplicate),
      status: "pending",
      bytes_uploaded: 0,
      file_size: metadata.fileSize,
      content_type: metadata.contentType,
      attempts: 0,
      created_at: now,
      updated_at: now
    });
    if (queueError) throw queueError;

    await syncPostStatusFromPublications(context.service, {
      organizationId: context.organizationId,
      postId: body.postId ?? null
    });

    return NextResponse.json({
      queued: true,
      jobId,
      publicationId,
      fileSize: metadata.fileSize,
      contentType: metadata.contentType
    });
  } catch (error) {
    if (context) {
      await recordDiagnostic(context.service, {
        organizationId: context.organizationId,
        provider: "youtube",
        service: "youtube",
        error,
        category: "fila",
        severity: "erro",
        eventKey: `fila:youtube:criar:${postId || "sem-post"}`,
        title: "Falha ao criar fila de upload do YouTube",
        profileId: context.userId,
        targetKind: "post",
        targetId: postId || undefined,
        metadata: { operation: "criar_fila" }
      }).catch(() => undefined);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enfileirar upload no YouTube." },
      { status: 400 }
    );
  }
}
