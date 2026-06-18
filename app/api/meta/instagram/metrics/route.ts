import { NextResponse } from "next/server";
import { recordIntegrationFailure, toApiErrorPayload } from "@/lib/api-errors";
import { fetchInstagramInsightsForMedia, fetchInstagramMedia, getInstagramConnection, metaRequestContext, type MetaRequestContext } from "@/lib/meta-server";

export async function GET(request: Request) {
  let context: MetaRequestContext | null = null;
  try {
    context = await metaRequestContext(request);
    const connection = await getInstagramConnection(context);
    const media = await fetchInstagramMedia(connection.access_token, connection.instagram_account_id);
    const metrics = await Promise.all(media.map(async (item) => ({
      ...item,
      ...await fetchInstagramInsightsForMedia(connection.access_token, item)
    })));
    return NextResponse.json({ metrics });
  } catch (error) {
    const payload = toApiErrorPayload(error, { provider: "instagram", service: "instagram" });
    if (context) await recordIntegrationFailure(context.service, context.organizationId, payload);
    return NextResponse.json(payload, { status: 400 });
  }
}
