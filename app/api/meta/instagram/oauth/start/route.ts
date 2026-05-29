import { NextResponse } from "next/server";
import { metaRequestContext, requireMetaManager, signMetaState, instagramAppId, instagramOAuthRedirectUri, INSTAGRAM_SCOPES } from "@/lib/meta-server";

export async function GET(request: Request) {
  try {
    const context = await metaRequestContext(request);
    requireMetaManager(context);

    const appId = instagramAppId();
    if (!appId) return NextResponse.json({ error: "INSTAGRAM_APP_ID nao configurado." }, { status: 500 });

    const state = signMetaState({
      userId: context.userId,
      organizationId: context.organizationId,
      nonce: crypto.randomUUID(),
      createdAt: Date.now()
    });

    // Instagram Business Login — usa instagram.com diretamente (gera token IGAA)
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", instagramOAuthRedirectUri(request));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
    url.searchParams.set("state", state);

    return NextResponse.json({ url: url.toString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao iniciar OAuth Instagram." },
      { status: 401 }
    );
  }
}
