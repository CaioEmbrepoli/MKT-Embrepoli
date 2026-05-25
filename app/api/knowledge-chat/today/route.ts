import { NextResponse } from "next/server";
import { authContext, ensureTodaySession, loadSessionBundle, mapGap, mapMessage, mapSession } from "../shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await authContext(request);
    const session = await ensureTodaySession(ctx);
    const bundle = await loadSessionBundle(ctx.service, session.id);
    const activeGap = (bundle.gaps ?? []).find((gap) => gap.status === "aguardando_resposta") ?? null;

    return NextResponse.json({
      session: mapSession(session),
      messages: (bundle.messages ?? []).map(mapMessage),
      gaps: (bundle.gaps ?? []).map(mapGap),
      activeGap: activeGap ? mapGap(activeGap) : null
    });
  } catch (error) {
    console.error("[knowledge-chat/today]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao carregar chat." }, { status: 500 });
  }
}
