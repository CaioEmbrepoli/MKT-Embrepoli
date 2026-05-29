import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGoogleAccessToken } from "@/lib/google-server";
import type { GoogleRequestContext } from "@/lib/google-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PublicationRow = {
  id: string;
  organization_id: string;
  post_id: string | null;
  external_id: string | null;
  attempts: number | null;
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase service role nao configurado." }, { status: 500 });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Busca publicações YouTube agendadas (privadas) ou em upload ainda não confirmadas
  const { data: publications, error } = await service
    .from("post_publications")
    .select("id, organization_id, post_id, external_id, attempts")
    .eq("platform", "youtube")
    .eq("status", "scheduled")
    .not("external_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!publications?.length) return NextResponse.json({ ok: true, processed: 0, results: [] });

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const pub of publications as PublicationRow[]) {
    const attempts = (pub.attempts ?? 0) + 1;
    try {
      // Busca token YouTube da organização (com refresh automático)
      const context: GoogleRequestContext = {
        service,
        userId: "cron",
        organizationId: pub.organization_id,
        role: "admin",
        active: true
      };
      const ytToken = await getGoogleAccessToken(context, "youtube");

      // Verifica status do vídeo na API do YouTube
      const verifyRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=status&id=${pub.external_id}`,
        { headers: { Authorization: `Bearer ${ytToken}` } }
      );
      if (!verifyRes.ok) throw new Error(`YouTube API error: ${verifyRes.status}`);

      const verifyData = await verifyRes.json() as {
        items?: { status: { privacyStatus: string; uploadStatus: string } }[]
      };
      const item = verifyData.items?.[0];
      if (!item) throw new Error("Vídeo não encontrado no YouTube.");

      const { privacyStatus, uploadStatus } = item.status;

      if (privacyStatus === "public" && uploadStatus === "processed") {
        const now = new Date().toISOString();
        await service.from("post_publications").update({
          status: "published",
          published_at: now,
          error: null,
          attempts,
          last_attempt_at: now,
          updated_at: now,
        }).eq("id", pub.id);

        if (pub.post_id) {
          await service.from("posts")
            .update({ status: "Publicado", published_at: now })
            .eq("organization_id", pub.organization_id)
            .eq("id", pub.post_id);
        }
        results.push({ id: pub.id, status: "published" });
      } else {
        // Ainda agendado/processando — atualiza apenas o attempt
        await service.from("post_publications").update({
          attempts,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", pub.id);
        results.push({ id: pub.id, status: `waiting (${privacyStatus}/${uploadStatus})` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao verificar vídeo no YouTube.";
      await service.from("post_publications").update({
        error: message,
        attempts,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", pub.id);
      results.push({ id: pub.id, status: "error", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export const POST = GET;
