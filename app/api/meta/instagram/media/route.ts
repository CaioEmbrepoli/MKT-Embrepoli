import { NextResponse } from "next/server";
import { fetchInstagramMedia, getInstagramConnection, metaRequestContext } from "@/lib/meta-server";

export async function GET(request: Request) {
  try {
    const context = await metaRequestContext(request);
    const connection = await getInstagramConnection(context);
    const media = await fetchInstagramMedia(connection.access_token, connection.instagram_account_id);
    return NextResponse.json({ media });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar midias do Instagram." },
      { status: 400 }
    );
  }
}
