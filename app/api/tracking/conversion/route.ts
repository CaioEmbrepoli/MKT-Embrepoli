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

    const email = body.email?.trim().toLowerCase() || "";
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    let personId: string | null = null;
    if (isValidEmail) {
      const { data } = await service.rpc("upsert_person_by_identifier", {
        p_org: organizationId,
        p_type: "email",
        p_value: email,
        p_name: null,
        p_channel: "site",
        p_channel_detail: "tray_checkout",
        p_visitor_id: resolvedVisitorId
      });
      personId = (data as string) ?? null;
    }

    const { data: conversion } = await service
      .from("conversions")
      .upsert(
        {
          organization_id: organizationId,
          visitor_id: resolvedVisitorId,
          person_id: personId,
          sale_value: saleValue,
          product_name: body.productName?.trim() || "",
          sale_date: new Date().toISOString().slice(0, 10),
          source: "tray_checkout",
          external_order_id: externalOrderId,
          notes: email ? `email:${email}` : ""
        },
        { onConflict: "organization_id,external_order_id" }
      )
      .select("id, sale_value, sale_date")
      .maybeSingle();

    // Uma conversão é uma compra concluída: a pessoa já é cliente, não só lead.
    // Liga (ou cria) o registro em sales_clients por email, igual ao padrão já
    // usado pelo webhook do Meta (autoLinkSalesClient), mas com status "cliente".
    if (personId && isValidEmail && conversion) {
      const { data: existingClients } = await service
        .from("sales_clients")
        .select("id, email, person_id")
        .eq("organization_id", organizationId);
      const existingClient = (existingClients ?? []).find(
        (c: { email: string }) => String(c.email ?? "").trim().toLowerCase() === email
      );

      if (existingClient) {
        await service
          .from("sales_clients")
          .update({
            person_id: existingClient.person_id ?? personId,
            status: "cliente",
            sales_funnel_stage: "fechado",
            last_purchase_at: conversion.sale_date,
            last_purchase_value: conversion.sale_value
          })
          .eq("id", existingClient.id);
        await service.from("conversions").update({ sales_client_id: existingClient.id }).eq("id", conversion.id);
      } else {
        const newClientId = crypto.randomUUID();
        await service.from("sales_clients").insert({
          id: newClientId,
          organization_id: organizationId,
          name: "Cliente Tray",
          client_type: "PF",
          email,
          phone: "",
          company: "",
          segment: "",
          state_uf: "",
          city: "",
          status: "cliente",
          source: "site",
          source_custom: "tray_checkout",
          notes: "",
          proposals: [],
          sales_funnel_stage: "fechado",
          last_purchase_at: conversion.sale_date,
          last_purchase_value: conversion.sale_value,
          person_id: personId
        });
        await service.from("conversions").update({ sales_client_id: newClientId }).eq("id", conversion.id);
      }
    }
  } catch {
    // Nunca retornar erro — não deve quebrar a loja
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
