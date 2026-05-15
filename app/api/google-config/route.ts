import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    apiKey: process.env.GOOGLE_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "",
    clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  });
}
