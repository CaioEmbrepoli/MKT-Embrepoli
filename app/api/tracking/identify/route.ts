import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyDocument } from "@/lib/document";

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

// Pessoa que se cadastra ou loga na loja demonstra intencao real, mas ainda
// nao comprou — entra como "lead", diferente da conversao (que ja e uma
// compra concluida e entra como "cliente"). Reaproveita upsert_person_by_identifier.
// No login so existe um campo ambiguo (email ou CPF/CNPJ), por isso o
// documento tambem serve de identificador primario quando nao ha email.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      visitorId?: string;
      organizationId?: string;
      name?: string;
      email?: string;
      phone?: string;
      document?: string;
      cpf?: string;
      event?: string;
    };

    const organizationId = body.organizationId?.trim();
    const email = body.email?.trim().toLowerCase() || "";
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const { cpf, cnpj } = classifyDocument(body.document ?? body.cpf ?? "");
    const hasValidDocument = Boolean(cpf || cnpj);

    if (!organizationId || (!isValidEmail && !hasValidDocument)) {
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
    const eventType = body.event === "login" ? "login" : "cadastro";
    const channelDetail = eventType === "login" ? "login_site" : "cadastro_site";

    const primaryType = isValidEmail ? "email" : cpf ? "cpf" : "cnpj";
    const primaryValue = isValidEmail ? email : cpf || cnpj;

    const { data: personIdData } = await service.rpc("upsert_person_by_identifier", {
      p_org: organizationId,
      p_type: primaryType,
      p_value: primaryValue,
      p_name: name || null,
      p_channel: "site",
      p_channel_detail: channelDetail,
      p_visitor_id: resolvedVisitorId
    });
    const personId = (personIdData as string) ?? null;
    if (!personId) {
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    // Se o documento nao foi o identificador primario (email foi), grava ele
    // como identifier adicional da mesma person — sem precisar de RPC nova.
    if (hasValidDocument && isValidEmail) {
      await service.from("person_identifiers").upsert(
        {
          organization_id: organizationId,
          person_id: personId,
          type: cpf ? "cpf" : "cnpj",
          value: cpf || cnpj
        },
        { onConflict: "organization_id,type,value", ignoreDuplicates: true }
      );
    }

    const orFilters: string[] = [];
    if (isValidEmail) orFilters.push(`email.eq.${email}`);
    if (cpf) orFilters.push(`cpf.eq.${cpf}`);
    if (cnpj) orFilters.push(`cnpj.eq.${cnpj}`);

    const { data: existingClients } = await service
      .from("sales_clients")
      .select("id, email, person_id, name, phone, cpf, cnpj")
      .eq("organization_id", organizationId)
      .or(orFilters.join(","));

    const clients = existingClients ?? [];
    const existingClient =
      (isValidEmail ? clients.find((c) => String(c.email ?? "").trim().toLowerCase() === email) : null) ??
      (cpf ? clients.find((c) => c.cpf === cpf) : null) ??
      (cnpj ? clients.find((c) => c.cnpj === cnpj) : null) ??
      null;

    if (existingClient) {
      await service
        .from("sales_clients")
        .update({
          person_id: existingClient.person_id ?? personId,
          email: existingClient.email || email || "",
          name: existingClient.name && existingClient.name !== "Cliente Tray" ? existingClient.name : (name || existingClient.name),
          phone: existingClient.phone || phone,
          cpf: existingClient.cpf || cpf || null,
          cnpj: existingClient.cnpj || cnpj || null
        })
        .eq("id", existingClient.id);
    } else {
      await service.from("sales_clients").insert({
        id: crypto.randomUUID(),
        organization_id: organizationId,
        name: name || "Lead site",
        client_type: cnpj ? "PJ" : "PF",
        email: email || "",
        phone,
        cpf: cpf || null,
        cnpj: cnpj || null,
        company: "",
        segment: "",
        state_uf: "",
        city: "",
        status: "lead",
        source: "site",
        source_custom: channelDetail,
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
