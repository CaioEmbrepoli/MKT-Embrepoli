import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      visitorId?: string;
      organizationId?: string;
      utmSource?: string | null;
      utmMedium?: string | null;
      utmCampaign?: string | null;
      fbclid?: string | null;
      gclid?: string | null;
      referrer?: string | null;
      page?: string | null;
    };

    const visitorId = body.visitorId?.trim();
    const organizationId = body.organizationId?.trim();

    if (!visitorId || !organizationId) {
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    await service.rpc("upsert_visitor", {
      p_id: visitorId,
      p_org: organizationId,
      p_source: body.utmSource ?? null,
      p_medium: body.utmMedium ?? null,
      p_campaign: body.utmCampaign ?? null,
      p_referrer: body.referrer ?? null,
      p_fbclid: body.fbclid ?? null,
      p_gclid: body.gclid ?? null,
      p_page: body.page ?? null
    });
  } catch {
    // Nunca retornar erro — não deve quebrar o site
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
