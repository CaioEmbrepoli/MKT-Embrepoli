import { NextResponse } from "next/server";
import { authContext } from "@/app/api/knowledge-chat/shared";

export const dynamic = "force-dynamic";

// Rota de setup único da integração Tray: deve ser chamada uma vez (manualmente,
// via curl/Postman) com o `code` gerado no painel da Tray (Meus Aplicativos > app > Acessar).
// Salva access_token/refresh_token em `tray_integration` para uso pelo RAG.
export async function POST(request: Request) {
  try {
    const ctx = await authContext(request);
    if (ctx.profile.role !== "admin" && ctx.profile.role !== "gestor") {
      return NextResponse.json({ error: "Apenas administradores podem configurar a integração Tray." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as {
      apiAddress?: string;
      consumerKey?: string;
      consumerSecret?: string;
      code?: string;
    };

    const apiAddress = String(body.apiAddress ?? "").trim().replace(/\/$/, "");
    const consumerKey = String(body.consumerKey ?? "").trim();
    const consumerSecret = String(body.consumerSecret ?? "").trim();
    const code = String(body.code ?? "").trim();

    if (!apiAddress || !consumerKey || !consumerSecret || !code) {
      return NextResponse.json({ error: "apiAddress, consumerKey, consumerSecret e code são obrigatórios." }, { status: 400 });
    }

    const res = await fetch(`${apiAddress}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret, code })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Tray respondeu ${res.status}: ${text}`);
    }

    const data = await res.json() as { access_token?: string; refresh_token?: string; date_expiration?: string };
    if (!data.access_token || !data.refresh_token) {
      throw new Error("Resposta da Tray sem access_token/refresh_token.");
    }

    const expiresAt = data.date_expiration ?? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    const { error } = await ctx.service
      .from("tray_integration")
      .upsert({
        organization_id: ctx.organizationId,
        api_address: apiAddress,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: "organization_id" });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao configurar integração Tray." },
      { status: 400 }
    );
  }
}
