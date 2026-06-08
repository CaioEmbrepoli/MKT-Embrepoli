import { NextResponse } from "next/server";
import {
  metaRequestContext,
  requireMetaManager,
  signMetaState,
  instagramAppId,
  instagramOAuthRedirectUri,
  INSTAGRAM_BUSINESS_SCOPES,
  INSTAGRAM_OAUTH_AUTHORIZE_URL
} from "@/lib/meta-server";

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

    // Instagram Business Login (login direto pela conta do Instagram, gera tokens IGAA...)
    // Doc: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
    const url = new URL(INSTAGRAM_OAUTH_AUTHORIZE_URL);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", instagramOAuthRedirectUri(request));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", INSTAGRAM_BUSINESS_SCOPES.join(","));
    url.searchParams.set("state", state);

    return NextResponse.json({ url: url.toString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao iniciar OAuth Instagram." },
      { status: 401 }
    );
  }
}
