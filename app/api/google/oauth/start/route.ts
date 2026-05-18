import { NextResponse } from "next/server";
import { GOOGLE_SCOPES, googleRedirectUri, googleRequestContext, requireGoogleManager, signGoogleState } from "@/lib/google-server";

export async function GET(request: Request) {
  try {
    const context = await googleRequestContext(request);
    requireGoogleManager(context);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return NextResponse.json({ error: "GOOGLE_CLIENT_ID nao configurado." }, { status: 500 });

    const state = signGoogleState({
      userId: context.userId,
      organizationId: context.organizationId,
      nonce: crypto.randomUUID(),
      createdAt: Date.now()
    });

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", googleRedirectUri(request));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);

    return NextResponse.json({ url: url.toString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao iniciar OAuth Google." }, { status: 401 });
  }
}
