import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase service role não configurado." }, { status: 500 });
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const nowIso = new Date().toISOString();
    const { data: expiredComments, error: selectError } = await service
      .from("comments")
      .select("id")
      .lt("retention_until", nowIso)
      .eq("added_to_bank", false)
      .is("bank_question_id", null);
    if (selectError) throw new Error(`comments cleanup select: ${selectError.message}`);

    if (expiredComments?.length) {
      const { error: deleteError } = await service
        .from("comments")
        .delete()
        .in("id", expiredComments.map((item) => item.id));
      if (deleteError) throw new Error(`comments cleanup delete: ${deleteError.message}`);
    }

    return NextResponse.json({
      ok: true,
      executedAt: nowIso,
      deletedComments: expiredComments?.length ?? 0
    });
  } catch (error) {
    console.error("[data-retention/cleanup]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao limpar dados expirados." }, { status: 500 });
  }
}
