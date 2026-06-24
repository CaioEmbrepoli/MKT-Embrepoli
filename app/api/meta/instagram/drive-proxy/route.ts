import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getGoogleAccessToken, verifyDriveProxyToken, type GoogleRequestContext } from "@/lib/google-server";

// Ponte transparente entre o Drive e a Meta: a Meta busca essa URL pra obter
// o video_url/image_url da publicacao, e aqui a gente busca o arquivo no
// Drive na hora e repassa os bytes — sem nunca salvar em storage nenhum.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 400 });

  let payload: { fileId: string; organizationId: string };
  try {
    payload = verifyDriveProxyToken(token);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Token invalido." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const context: GoogleRequestContext = {
    userId: "drive-proxy",
    organizationId: payload.organizationId,
    role: "admin",
    active: true,
    service
  };

  let driveToken: string;
  try {
    driveToken = await getGoogleAccessToken(context, "drive");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Google Drive nao conectado." }, { status: 502 });
  }

  const rangeHeader = request.headers.get("range");
  const driveHeaders: Record<string, string> = { Authorization: `Bearer ${driveToken}` };
  if (rangeHeader) driveHeaders.Range = rangeHeader;

  const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${payload.fileId}?alt=media`, {
    headers: driveHeaders
  });
  if (!driveRes.ok && driveRes.status !== 206) {
    return NextResponse.json({ error: `Erro ao buscar arquivo do Drive (HTTP ${driveRes.status}).` }, { status: 502 });
  }
  if (!driveRes.body) {
    return NextResponse.json({ error: "Drive nao retornou conteudo." }, { status: 502 });
  }

  const headers = new Headers();
  const contentType = driveRes.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const contentLength = driveRes.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = driveRes.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  headers.set("Accept-Ranges", "bytes");

  return new NextResponse(driveRes.body, { status: driveRes.status, headers });
}
