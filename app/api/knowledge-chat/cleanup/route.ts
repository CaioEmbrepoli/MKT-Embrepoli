import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { archiveExpiry, saoPauloDateKey } from "../shared";

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

    const now = new Date();
    const today = saoPauloDateKey(now);
    const nowIso = now.toISOString();
    const expiresAt = archiveExpiry(now);

    const { data: sessionsToArchive, error: archiveSelectError } = await service
      .from("knowledge_chat_sessions")
      .select("id")
      .eq("status", "active")
      .lt("date_key", today);
    if (archiveSelectError) throw new Error(`sessions archive select: ${archiveSelectError.message}`);

    if (sessionsToArchive?.length) {
      const { error: archiveError } = await service
        .from("knowledge_chat_sessions")
        .update({ status: "archived", archived_at: nowIso, expires_at: expiresAt, updated_at: nowIso })
        .in("id", sessionsToArchive.map((item) => item.id));
      if (archiveError) throw new Error(`sessions archive update: ${archiveError.message}`);
    }

    const { data: expiredSessions, error: expiredSelectError } = await service
      .from("knowledge_chat_sessions")
      .select("id")
      .eq("status", "archived")
      .lte("expires_at", nowIso);
    if (expiredSelectError) throw new Error(`expired sessions select: ${expiredSelectError.message}`);

    if (expiredSessions?.length) {
      const { error: deleteError } = await service
        .from("knowledge_chat_sessions")
        .delete()
        .in("id", expiredSessions.map((item) => item.id));
      if (deleteError) throw new Error(`expired sessions delete: ${deleteError.message}`);
    }

    return NextResponse.json({
      archived: sessionsToArchive?.length ?? 0,
      deleted: expiredSessions?.length ?? 0
    });
  } catch (error) {
    console.error("[knowledge-chat/cleanup]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao limpar chats." }, { status: 500 });
  }
}
