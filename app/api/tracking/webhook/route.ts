import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

function extractVisitorRef(text: string): string | null {
  const match = /\[ref:([a-zA-Z0-9-]+)\]/.exec(text);
  return match ? match[1] : null;
}

export async function POST(request: Request) {
  try {
    const secret = process.env.TRACKING_WEBHOOK_SECRET;
    if (secret) {
      const header = request.headers.get("x-webhook-secret");
      if (header !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = (await request.json()) as Record<string, unknown>;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ ok: false, error: "misconfigured" }, { status: 500 });
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // WhatsApp Business API format
    if (body.messaging_product === "whatsapp" || body.object === "whatsapp_business_account") {
      const entries = (body.entry as unknown[]) ?? [];
      for (const entry of entries) {
        const changes = ((entry as Record<string, unknown>).changes as unknown[]) ?? [];
        for (const change of changes) {
          const value = (change as Record<string, unknown>).value as Record<string, unknown>;
          const messages = (value?.messages as unknown[]) ?? [];
          for (const msg of messages) {
            const m = msg as Record<string, unknown>;
            const phone = normalizePhone(String(m.from ?? ""));
            const messageText = String((m.text as Record<string, unknown>)?.body ?? "");
            const visitorRef = extractVisitorRef(messageText);
            const org = String(body.organizationId ?? process.env.DEFAULT_ORG_ID ?? "embrepoli");

            if (phone.length >= 10) {
              await service.rpc("upsert_person_by_phone", {
                p_org: org,
                p_phone: phone,
                p_name: null,
                p_channel: "whatsapp",
                p_channel_detail: null,
                p_visitor_id: visitorRef
              });
            }
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    // Meta Lead Ads format
    if (body.object === "page" && body.entry) {
      const entries = (body.entry as unknown[]) ?? [];
      for (const entry of entries) {
        const changes = ((entry as Record<string, unknown>).changes as unknown[]) ?? [];
        for (const change of changes) {
          const c = change as Record<string, unknown>;
          if (c.field !== "leadgen") continue;
          const value = c.value as Record<string, unknown>;
          const org = String(body.organizationId ?? process.env.DEFAULT_ORG_ID ?? "embrepoli");
          const phone = value.phone_number ? normalizePhone(String(value.phone_number)) : null;
          const name = String(value.full_name ?? "");
          const campaign = String(value.ad_name ?? value.campaign_name ?? "");

          if (phone && phone.length >= 10) {
            await service.rpc("upsert_person_by_phone", {
              p_org: org,
              p_phone: phone,
              p_name: name || null,
              p_channel: "facebook",
              p_channel_detail: campaign || null,
              p_visitor_id: null
            });
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    // Formato genérico: { type, phone, name?, email?, visitorRef?, channel?, channelDetail?, organizationId? }
    const org = String(body.organizationId ?? process.env.DEFAULT_ORG_ID ?? "embrepoli");
    const phone = body.phone ? normalizePhone(String(body.phone)) : null;
    const channel = String(body.channel ?? "outro");
    const channelDetail = body.channelDetail ? String(body.channelDetail) : null;
    const name = body.name ? String(body.name) : null;
    const visitorRef = body.visitorRef ? String(body.visitorRef) : null;

    if (phone && phone.length >= 10) {
      await service.rpc("upsert_person_by_phone", {
        p_org: org,
        p_phone: phone,
        p_name: name,
        p_channel: channel,
        p_channel_detail: channelDetail,
        p_visitor_id: visitorRef
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tracking/webhook]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// Meta exige resposta 200 ao verificar o webhook
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = process.env.TRACKING_WEBHOOK_SECRET ?? "";

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
