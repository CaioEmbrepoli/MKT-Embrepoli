import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/dev-login
 *
 * Faz login automático no ambiente de desenvolvimento (localhost).
 * Em produção retorna 403 imediatamente.
 * Lê as credenciais de DEV_LOGIN_EMAIL e DEV_LOGIN_PASSWORD no .env.local.
 */
export async function POST() {
  // Bloqueia em produção
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.DEV_LOGIN_EMAIL;
  const password = process.env.DEV_LOGIN_PASSWORD;

  if (!url || !anonKey || !email || !password) {
    return NextResponse.json(
      { error: "Dev login não configurado. Verifique DEV_LOGIN_EMAIL e DEV_LOGIN_PASSWORD no .env.local." },
      { status: 500 }
    );
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message ?? "Falha no login automático de dev." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
