import { NextResponse } from "next/server";
import {
  META_ADS_SCOPES,
  metaAdsOAuthRedirectUri,
  metaAppId,
  metaOAuthAuthorizeUrl,
  metaRequestContext,
  requireMetaManager,
  signMetaState
} from "@/lib/meta-server";

export async function GET(request: Request) {
  try {
    const context = await metaRequestContext(request);
    requireMetaManager(context);
    const appId = metaAppId();
    if (!appId) throw new Error("META_APP_ID nao configurado.");

    const state = signMetaState({
      userId: context.userId,
      organizationId: context.organizationId,
      service: "ads",
      createdAt: Date.now()
    });
    const url = new URL(metaOAuthAuthorizeUrl());
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", metaAdsOAuthRedirectUri(request));
    url.searchParams.set("state", state);
    url.searchParams.set("scope", META_ADS_SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("auth_type", "rerequest");
    return NextResponse.json({ url: url.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao iniciar OAuth Meta Ads.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
