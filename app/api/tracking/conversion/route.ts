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
      externalOrderId?: string;
      saleValue?: number | string;
      productName?: string;
      email?: string | null;
    };

    const organizationId = body.organizationId?.trim();
    const externalOrderId = body.externalOrderId?.trim();
    const saleValue = Number(body.saleValue);

    if (!organizationId || !externalOrderId || !Number.isFinite(saleValue)) {
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

    const visitorId = body.visitorId?.trim() || null;
    let resolvedVisitorId: string | null = null;
    if (visitorId) {
      const { data: visitor } = await service
        .from("visitors")
        .select("id")
        .eq("id", visitorId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      resolvedVisitorId = visitor?.id ?? null;
    }

    await service.from("conversions").upsert(
      {
        organization_id: organizationId,
        visitor_id: resolvedVisitorId,
        sale_value: saleValue,
        product_name: body.productName?.trim() || "",
        sale_date: new Date().toISOString().slice(0, 10),
        source: "tray_checkout",
        external_order_id: externalOrderId,
        notes: body.email ? `email:${body.email.trim()}` : ""
      },
      { onConflict: "organization_id,external_order_id" }
    );
  } catch {
    // Nunca retornar erro — não deve quebrar a loja
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
