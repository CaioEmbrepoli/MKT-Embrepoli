import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetaAdsConnection, graphGet, type MetaRequestContext } from "@/lib/meta-server";

type MetaPaging<T> = {
  data?: T[];
  paging?: { next?: string };
};

type MetaAdAccount = {
  id?: string;
  account_id?: string;
  name?: string;
  currency?: string;
  account_status?: number | string;
};

type MetaCampaign = {
  id?: string;
  name?: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
};

type MetaAdSet = {
  id?: string;
  name?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: { geo_locations?: { countries?: string[]; regions?: Array<{ name?: string }>; cities?: Array<{ name?: string }> } };
};

type MetaAd = {
  id?: string;
  name?: string;
  campaign_id?: string;
  adset_id?: string;
  status?: string;
  effective_status?: string;
  creative?: { name?: string; thumbnail_url?: string; effective_object_story_id?: string };
};

type MetaInsight = {
  account_id?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
  action_values?: Array<{ action_type?: string; value?: string }>;
  video_play_actions?: Array<{ action_type?: string; value?: string }>;
};

export type MetaAdsImportSummary = {
  accounts: number;
  campaigns: number;
  adSets: number;
  ads: number;
  insights: number;
  datePreset: string;
};

type TableRow = Record<string, any> & { id: string; external_id?: string | null };

function metaAccountPath(account: MetaAdAccount) {
  const raw = String(account.id || account.account_id || "");
  if (!raw) return "";
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

function normalizeStatus(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (["active", "enabled"].includes(value)) return "active";
  if (["paused", "inactive"].includes(value)) return "paused";
  if (["archived"].includes(value)) return "archived";
  if (["deleted"].includes(value)) return "deleted";
  return "unknown";
}

function accountStatus(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (value === "1" || value === "active") return "active";
  if (value === "2" || value === "disabled") return "paused";
  if (value === "3" || value === "unsettled") return "paused";
  if (value === "7" || value === "pending_risk_review") return "paused";
  if (value === "9" || value === "pending_settlement") return "paused";
  return normalizeStatus(value);
}

function moneyCents(value: unknown) {
  const raw = Number(value || 0);
  return Number.isFinite(raw) && raw > 0 ? raw / 100 : undefined;
}

function budget(item: { daily_budget?: string; lifetime_budget?: string }) {
  if (item.daily_budget) return { amount: moneyCents(item.daily_budget), type: "daily" };
  if (item.lifetime_budget) return { amount: moneyCents(item.lifetime_budget), type: "lifetime" };
  return { amount: undefined, type: "unknown" };
}

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function int(value: unknown) {
  return Math.round(num(value));
}

function actionValue(actions: MetaInsight["actions"], match: (type: string) => boolean) {
  return (actions || []).reduce((sum, item) => {
    const type = String(item.action_type || "").toLowerCase();
    return match(type) ? sum + num(item.value) : sum;
  }, 0);
}

function safeDivide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

async function fetchPaged<T>(accessToken: string, path: string, params: Record<string, string>, maxPages = 50) {
  const items: T[] = [];
  let nextUrl = path;
  let page = 0;
  while (nextUrl && page < maxPages) {
    const data = await graphGet<MetaPaging<T>>(nextUrl, accessToken, page === 0 ? params : {});
    items.push(...(data.data || []));
    nextUrl = data.paging?.next || "";
    page += 1;
  }
  return items;
}

async function mergeRows(
  client: SupabaseClient,
  table: string,
  organizationId: string,
  rows: TableRow[],
  parentFilter?: { column: string; value: string },
  onConflict?: string
) {
  if (!rows.length) return new Map<string, string>();
  let query: any = client
    .from(table)
    .select("id, external_id")
    .eq("organization_id", organizationId)
    .in("external_id", rows.map((row) => row.external_id).filter(Boolean));
  if (parentFilter) query = query.eq(parentFilter.column, parentFilter.value);
  const { data, error } = await query;
  if (error) throw new Error(`${table} select: ${error.message}`);

  const existing = new Map<string, string>();
  for (const row of (data || []) as Array<{ id: string; external_id: string | null }>) {
    if (row.external_id) existing.set(row.external_id, row.id);
  }

  const payload = rows.map((row) => ({
    ...row,
    id: row.external_id && existing.has(row.external_id) ? existing.get(row.external_id) : row.id
  }));
  const upsertOpts = onConflict ? { onConflict } : undefined;
  const { error: upsertError } = await client.from(table).upsert(payload, upsertOpts);
  if (upsertError) throw new Error(`${table} upsert: ${upsertError.message}`);

  return new Map(payload.map((row) => [String(row.external_id || row.id), String(row.id)]));
}

function actionMetrics(insight: MetaInsight) {
  const leads = actionValue(insight.actions, (type) => type.includes("lead") && type !== "landing_page_view");
  const landingPageViews = actionValue(insight.actions, (type) => type === "landing_page_view");
  const conversations = actionValue(insight.actions, (type) => type.includes("messaging_conversation_started") || type.includes("onsite_conversion.messaging"));
  const purchases = actionValue(insight.actions, (type) => type === "purchase" || type.endsWith(".purchase"));
  const purchaseValue = actionValue(insight.action_values, (type) => type === "purchase" || type.endsWith(".purchase"));
  const engagements = actionValue(insight.actions, (type) => ["post_engagement", "page_engagement"].includes(type));
  const videoViews = actionValue(insight.actions, (type) => type === "video_view") || actionValue(insight.video_play_actions, () => true);
  return { leads, landingPageViews, conversations, purchases, purchaseValue, engagements, videoViews };
}

export async function importMetaAdsData(context: MetaRequestContext): Promise<MetaAdsImportSummary> {
  const connection = await getMetaAdsConnection(context);
  const token = connection.access_token;
  const now = new Date().toISOString();

  const metaAccounts = await fetchPaged<MetaAdAccount>(token, "/me/adaccounts", {
    fields: "id,account_id,name,currency,account_status",
    limit: "100"
  });

  const accounts = metaAccounts.filter((account) => account.id || account.account_id);
  const accountRows: TableRow[] = accounts.map((account) => ({
    id: crypto.randomUUID(),
    organization_id: context.organizationId,
    platform: "meta",
    external_id: String(account.id || account.account_id),
    name: String(account.name || account.id || "Conta Meta Ads"),
    currency: String(account.currency || "BRL"),
    status: accountStatus(account.account_status),
    updated_at: now
  }));
  const accountMap = await mergeRows(context.service, "ad_accounts", context.organizationId, accountRows, undefined, "organization_id,platform,external_id");

  let campaignCount = 0;
  let adSetCount = 0;
  let adCount = 0;
  let insightCount = 0;

  for (const account of accounts) {
    const accountExternalId = String(account.id || account.account_id);
    const accountId = accountMap.get(accountExternalId);
    const accountPath = metaAccountPath(account);
    if (!accountId || !accountPath) continue;

    const campaigns = await fetchPaged<MetaCampaign>(token, `/${accountPath}/campaigns`, {
      fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time",
      limit: "100"
    });
    const campaignRows: TableRow[] = campaigns.filter((item) => item.id).map((item) => {
      const b = budget(item);
      return {
        id: crypto.randomUUID(),
        organization_id: context.organizationId,
        account_id: accountId,
        external_id: String(item.id),
        name: String(item.name || item.id),
        objective: String(item.objective || ""),
        status: normalizeStatus(item.effective_status || item.status),
        budget_amount: b.amount ?? null,
        budget_type: b.type,
        starts_at: item.start_time || null,
        ends_at: item.stop_time || null,
        updated_at: now
      };
    });
    const campaignMap = await mergeRows(context.service, "ad_campaigns", context.organizationId, campaignRows, { column: "account_id", value: accountId }, "organization_id,account_id,external_id");
    campaignCount += campaignRows.length;

    const adSets = await fetchPaged<MetaAdSet>(token, `/${accountPath}/adsets`, {
      fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,targeting",
      limit: "100"
    });
    const adSetRows: TableRow[] = adSets.filter((item) => item.id && item.campaign_id && campaignMap.has(String(item.campaign_id))).map((item) => {
      const b = budget(item);
      const targeting = item.targeting?.geo_locations;
      const regionNames = (targeting?.regions || []).map((region) => region.name).filter(Boolean) as string[];
      const cityNames = (targeting?.cities || []).map((city) => city.name).filter(Boolean) as string[];
      const audienceName = [
        ...(targeting?.countries || []),
        ...regionNames,
        ...cityNames
      ].slice(0, 4).join(", ");
      return {
        id: crypto.randomUUID(),
        organization_id: context.organizationId,
        account_id: accountId,
        campaign_id: campaignMap.get(String(item.campaign_id)),
        external_id: String(item.id),
        name: String(item.name || item.id),
        audience_name: audienceName || null,
        status: normalizeStatus(item.effective_status || item.status),
        budget_amount: b.amount ?? null,
        budget_type: b.type,
        updated_at: now
      };
    });
    const adSetMap = await mergeRows(context.service, "ad_sets", context.organizationId, adSetRows, undefined, "organization_id,campaign_id,external_id");
    adSetCount += adSetRows.length;

    const ads = await fetchPaged<MetaAd>(token, `/${accountPath}/ads`, {
      fields: "id,name,campaign_id,adset_id,status,effective_status,creative{name,thumbnail_url,effective_object_story_id}",
      limit: "100"
    });
    const adRows: TableRow[] = ads.filter((item) => item.id && item.campaign_id && campaignMap.has(String(item.campaign_id))).map((item) => ({
      id: crypto.randomUUID(),
      organization_id: context.organizationId,
      account_id: accountId,
      campaign_id: campaignMap.get(String(item.campaign_id)),
      ad_set_id: item.adset_id && adSetMap.has(String(item.adset_id)) ? adSetMap.get(String(item.adset_id)) : null,
      external_id: String(item.id),
      name: String(item.name || item.id),
      creative_name: item.creative?.name || null,
      status: normalizeStatus(item.effective_status || item.status),
      thumbnail_url: item.creative?.thumbnail_url || null,
      source_url: item.creative?.effective_object_story_id || null,
      updated_at: now
    }));
    const adMap = await mergeRows(context.service, "ads", context.organizationId, adRows, undefined, "organization_id,campaign_id,external_id");
    adCount += adRows.length;

    const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const { error: deleteInsightsError } = await context.service
      .from("ad_insights_daily")
      .delete()
      .eq("organization_id", context.organizationId)
      .eq("platform", "meta")
      .eq("account_id", accountId)
      .gte("date", since)
      .lte("date", today);
    if (deleteInsightsError) throw new Error(`ad_insights_daily delete: ${deleteInsightsError.message}`);

    const insights = await fetchPaged<MetaInsight>(token, `/${accountPath}/insights`, {
      level: "ad",
      time_increment: "1",
      date_preset: "last_30d",
      fields: "account_id,campaign_id,adset_id,ad_id,date_start,date_stop,spend,impressions,reach,frequency,cpm,clicks,inline_link_clicks,ctr,cpc,actions,action_values,video_play_actions",
      limit: "500"
    });
    const insightRowsByKey = new Map<string, Record<string, unknown>>();
    for (const insight of insights) {
      const spend = num(insight.spend);
      const metrics = actionMetrics(insight);
      const engagements = metrics.engagements || metrics.leads + metrics.conversations + metrics.purchases + metrics.videoViews;
      const row = {
        id: crypto.randomUUID(),
        organization_id: context.organizationId,
        platform: "meta",
        account_id: accountId,
        campaign_id: insight.campaign_id && campaignMap.has(String(insight.campaign_id)) ? campaignMap.get(String(insight.campaign_id)) : null,
        ad_set_id: insight.adset_id && adSetMap.has(String(insight.adset_id)) ? adSetMap.get(String(insight.adset_id)) : null,
        ad_id: insight.ad_id && adMap.has(String(insight.ad_id)) ? adMap.get(String(insight.ad_id)) : null,
        date: String(insight.date_start || today),
        spend,
        impressions: int(insight.impressions),
        reach: int(insight.reach),
        frequency: num(insight.frequency),
        cpm: num(insight.cpm),
        clicks: int(insight.clicks),
        link_clicks: int(insight.inline_link_clicks),
        ctr: num(insight.ctr),
        cpc: num(insight.cpc),
        landing_page_views: int(metrics.landingPageViews),
        leads: int(metrics.leads),
        cost_per_lead: safeDivide(spend, metrics.leads),
        conversations: int(metrics.conversations),
        cost_per_conversation: safeDivide(spend, metrics.conversations),
        purchases: int(metrics.purchases),
        purchase_value: metrics.purchaseValue,
        cost_per_purchase: safeDivide(spend, metrics.purchases),
        roas: safeDivide(metrics.purchaseValue, spend),
        engagements: int(engagements),
        video_views: int(metrics.videoViews),
        cost_per_engagement: safeDivide(spend, engagements),
        breakdown_placement: null,
        breakdown_age: null,
        breakdown_gender: null,
        breakdown_region: null,
        breakdown_device: null,
        updated_at: now
      };
      const insightKey = [
        row.organization_id,
        row.platform,
        row.account_id,
        row.campaign_id ?? "",
        row.ad_set_id ?? "",
        row.ad_id ?? "",
        row.date,
        row.breakdown_placement ?? "",
        row.breakdown_age ?? "",
        row.breakdown_gender ?? "",
        row.breakdown_region ?? "",
        row.breakdown_device ?? ""
      ].join("|");
      insightRowsByKey.set(insightKey, row);
    }
    const insightRows = Array.from(insightRowsByKey.values());
    if (insightRows.length) {
      const { error } = await context.service.from("ad_insights_daily").insert(insightRows);
      if (error) throw new Error(`ad_insights_daily insert: ${error.message}`);
    }
    insightCount += insightRows.length;
  }

  return {
    accounts: accountRows.length,
    campaigns: campaignCount,
    adSets: adSetCount,
    ads: adCount,
    insights: insightCount,
    datePreset: "last_30d"
  };
}
