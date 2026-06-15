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
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          {
            dateRanges,
            dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
            metrics: [{ name: "sessions" }, { name: "totalUsers" }],
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: 25
          },
          {
            dateRanges,
            dimensions: [{ name: "date" }],
            metrics: [{ name: "sessions" }, { name: "totalUsers" }],
            orderBys: [{ dimension: { dimensionName: "date" } }]
          },
          {
            dateRanges,
            dimensions: [{ name: "deviceCategory" }],
            metrics: [{ name: "sessions" }],
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }]
          },
          {
            dateRanges,
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }],
            orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
            limit: 10
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || "Erro ao consultar Google Analytics.");
    }

    const reports = data.reports ?? [];

    const rows = (reports[0]?.rows ?? []).map((row: any) => ({
      source: row.dimensionValues?.[0]?.value ?? "(not set)",
      medium: row.dimensionValues?.[1]?.value ?? "(not set)",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      users: Number(row.metricValues?.[1]?.value ?? 0)
    }));

    const daily = (reports[1]?.rows ?? []).map((row: any) => {
      const raw = String(row.dimensionValues?.[0]?.value ?? "");
      const date = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
      return {
        date,
        sessions: Number(row.metricValues?.[0]?.value ?? 0),
        users: Number(row.metricValues?.[1]?.value ?? 0)
      };
    });

    const devices = (reports[2]?.rows ?? []).map((row: any) => ({
      device: row.dimensionValues?.[0]?.value ?? "(not set)",
      sessions: Number(row.metricValues?.[0]?.value ?? 0)
    }));

    const topPages = (reports[3]?.rows ?? []).map((row: any) => ({
      page: row.dimensionValues?.[0]?.value ?? "(not set)",
      views: Number(row.metricValues?.[0]?.value ?? 0)
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
      endDate: endDate.toISOString().slice(0, 10),
      daily,
      devices,
      topPages
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao consultar Google Analytics." }, { status: 401 });
  }
}
