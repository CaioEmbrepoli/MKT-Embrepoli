import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * O agendamento de publicações do Instagram agora é feito nativamente pela Meta API
 * (published=false + scheduled_publish_time). Este cron não é mais necessário para publicar.
 */
export async function GET() {
  return NextResponse.json({ ok: true, processed: 0, message: "Agendamento nativo Meta ativo. Cron nao utilizado." });
}

export const POST = GET;
