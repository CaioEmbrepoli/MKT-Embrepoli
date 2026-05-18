import { NextResponse } from "next/server";
import { getGoogleConnection, googleRequestContext } from "@/lib/google-server";

export async function GET(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const connection = await getGoogleConnection(context.service, context.organizationId);
    return NextResponse.json({
      connected: Boolean(connection?.refresh_token),
      googleEmail: connection?.google_email ?? "",
      scopes: connection?.scopes ?? [],
      connectedAt: connection?.connected_at ?? "",
      updatedAt: connection?.updated_at ?? "",
      canManage: context.role === "admin" || context.role === "gestor"
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao consultar conexao Google." }, { status: 401 });
  }
}
