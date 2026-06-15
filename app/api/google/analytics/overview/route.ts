import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) {
      return NextResponse.json({ error: "GA4_PROPERTY_ID nao configurado." }, { status: 500 });
    }

    const accessToken = await getGoogleAccessToken(context, "analytics");

    const days = Number(new URL(request.url).searchParams.get("days") ?? "30") || 30;

    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 25
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || "Erro ao consultar Google Analytics.");
    }

    const rows = (data.rows ?? []).map((row: any) => ({
      source: row.dimensionValues?.[0]?.value ?? "(not set)",
      medium: row.dimensionValues?.[1]?.value ?? "(not set)",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      users: Number(row.metricValues?.[1]?.value ?? 0)
    }));

    const totalSessions = rows.reduce((sum: number, row: any) => sum + row.sessions, 0);
    const totalUsers = rows.reduce((sum: number, row: any) => sum + row.users, 0);

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    return NextResponse.json({
      rows,
      totalSessions,
      totalUsers,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao consultar Google Analytics." }, { status: 401 });
  }
}
