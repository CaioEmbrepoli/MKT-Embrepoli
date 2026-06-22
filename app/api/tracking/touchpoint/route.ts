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
      eventType?: string;
      eventData?: Record<string, unknown>;
      sessionId?: string | null;
    };

    const visitorId = body.visitorId?.trim();
    const organizationId = body.organizationId?.trim();
    const eventType = body.eventType?.trim();

    if (!visitorId || !organizationId || !eventType) {
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

    await service.rpc("insert_touchpoint", {
      p_org: organizationId,
      p_visitor: visitorId,
      p_event_type: eventType,
      p_event_data: body.eventData ?? {},
      p_session_id: body.sessionId ?? null
    });
  } catch {
    // Nunca retornar erro — não deve quebrar o site
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
