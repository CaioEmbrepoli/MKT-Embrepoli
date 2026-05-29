import { NextResponse } from "next/server";
import { getTikTokScopes, requireTikTokManager, signTikTokState, tiktokClientKey, tiktokEnvironment, tiktokRedirectUri, tiktokRequestContext } from "@/lib/tiktok-server";

export async function GET(request: Request) {
  try {
    const context = await tiktokRequestContext(request);
    requireTikTokManager(context);

    const clientKey = tiktokClientKey();
    if (!clientKey) return NextResponse.json({ error: "TIKTOK_SANDBOX_CLIENT_KEY nao configurado." }, { status: 500 });

    const environment = tiktokEnvironment();
    const state = signTikTokState({
      userId: context.userId,
      organizationId: context.organizationId,
      environment,
      nonce: crypto.randomUUID(),
      createdAt: Date.now()
    });

    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("redirect_uri", tiktokRedirectUri(request));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", getTikTokScopes().join(" "));
    url.searchParams.set("state", state);

    return NextResponse.json({ url: url.toString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao iniciar OAuth TikTok." }, { status: 401 });
  }
}
