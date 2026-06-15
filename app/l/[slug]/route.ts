import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fallback = new URL("/", request.url);

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.redirect(fallback, 302);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: link } = await service
    .from("trackable_links")
    .select("id, destination_url, utm_source, utm_medium, utm_campaign")
    .eq("slug", slug)
    .maybeSingle();

  if (!link) {
    return NextResponse.redirect(fallback, 302);
  }

  await Promise.all([
    service.from("trackable_link_clicks").insert({
      link_id: link.id,
      referrer: request.headers.get("referer"),
      user_agent: request.headers.get("user-agent")
    }),
    service.rpc("increment_trackable_link_clicks", { p_link_id: link.id })
  ]);

  let destination = link.destination_url;
  if (link.utm_source || link.utm_medium || link.utm_campaign) {
    try {
      const target = new URL(link.destination_url);
      if (link.utm_source) target.searchParams.set("utm_source", link.utm_source);
      if (link.utm_medium) target.searchParams.set("utm_medium", link.utm_medium);
      if (link.utm_campaign) target.searchParams.set("utm_campaign", link.utm_campaign);
      destination = target.toString();
    } catch {
      destination = link.destination_url;
    }
  }

  return NextResponse.redirect(destination, 302);
}
