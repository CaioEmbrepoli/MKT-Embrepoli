import { NextResponse } from "next/server";
import { fetchInstagramCommentsForMedia, fetchInstagramMedia, getInstagramConnection, metaRequestContext } from "@/lib/meta-server";

export async function GET(request: Request) {
  try {
    const context = await metaRequestContext(request);
    const connection = await getInstagramConnection(context);
    const media = await fetchInstagramMedia(connection.access_token, connection.instagram_account_id);
    const comments = [];
    for (const item of media) {
      comments.push(...await fetchInstagramCommentsForMedia(connection.access_token, item));
    }
    return NextResponse.json({ comments, mediaCount: media.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar comentarios do Instagram." },
      { status: 400 }
    );
  }
}
