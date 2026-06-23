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

function normalizePhone(raw: string) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

// Pessoa que se cadastra na loja (cadastro_layout.php) demonstra intenção real,
// mas ainda não comprou — entra como "lead", diferente da conversão (que já é
// uma compra concluída e entra como "cliente"). Reaproveita upsert_person_by_identifier.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      visitorId?: string;
      organizationId?: string;
      name?: string;
      email?: string;
      phone?: string;
      cpf?: string;
    };

    const organizationId = body.organizationId?.trim();
    const email = body.email?.trim().toLowerCase() || "";
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!organizationId || !isValidEmail) {
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

    const name = body.name?.trim() || "";
    const phone = normalizePhone(body.phone ?? "");
    const cpf = body.cpf?.replace(/\D/g, "") || "";

    const { data: personIdData } = await service.rpc("upsert_person_by_identifier", {
      p_org: organizationId,
      p_type: "email",
      p_value: email,
      p_name: name || null,
      p_channel: "site",
      p_channel_detail: "cadastro_site",
      p_visitor_id: resolvedVisitorId
    });
    const personId = (personIdData as string) ?? null;
    if (!personId) {
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    const { data: existingClients } = await service
      .from("sales_clients")
      .select("id, email, person_id, name, phone, cpf")
      .eq("organization_id", organizationId);
    const existingClient = (existingClients ?? []).find(
      (c: { email: string }) => String(c.email ?? "").trim().toLowerCase() === email
    );

    if (existingClient) {
      await service
        .from("sales_clients")
        .update({
          person_id: existingClient.person_id ?? personId,
          name: existingClient.name && existingClient.name !== "Cliente Tray" ? existingClient.name : (name || existingClient.name),
          phone: existingClient.phone || phone,
          cpf: existingClient.cpf || cpf || null
        })
        .eq("id", existingClient.id);
    } else {
      await service.from("sales_clients").insert({
        id: crypto.randomUUID(),
        organization_id: organizationId,
        name: name || "Lead site",
        client_type: "PF",
        email,
        phone,
        cpf: cpf || null,
        company: "",
        segment: "",
        state_uf: "",
        city: "",
        status: "lead",
        source: "site",
        source_custom: "cadastro_site",
        notes: "",
        proposals: [],
        sales_funnel_stage: "lead",
        person_id: personId
      });
    }
  } catch (error) {
    console.error("[tracking/identify]", error);
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
