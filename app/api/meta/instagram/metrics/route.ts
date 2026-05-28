import { NextResponse } from "next/server";
import { fetchInstagramInsightsForMedia, fetchInstagramMedia, getInstagramConnection, metaRequestContext } from "@/lib/meta-server";

export async function GET(request: Request) {
  try {
    const context = await metaRequestContext(request);
    const connection = await getInstagramConnection(context);
    const media = await fetchInstagramMedia(connection.access_token, connection.instagram_account_id);
    const metrics = await Promise.all(media.map(async (item) => ({
      ...item,
      ...await fetchInstagramInsightsForMedia(connection.access_token, item)
    })));
    return NextResponse.json({ metrics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar metricas do Instagram." },
      { status: 400 }
    );
  }
}
