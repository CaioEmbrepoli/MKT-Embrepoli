import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const saoPauloOffsetMs = 3 * 60 * 60 * 1000;

type ResetTaskRow = {
  id: string;
  organization_id: string;
  reset_frequency: "none" | "daily" | "weekly" | "monthly";
  reset_time: string | null;
  reset_weekday: number | null;
  reset_month_day: number | null;
  reset_month_last_day: boolean | null;
  next_reset_at: string | null;
};

function parseTime(value: string | null) {
  const [rawHour, rawMinute] = (value || "23:59").split(":").map(Number);
  return {
    hour: Number.isFinite(rawHour) ? Math.min(23, Math.max(0, rawHour)) : 23,
    minute: Number.isFinite(rawMinute) ? Math.min(59, Math.max(0, rawMinute)) : 59
  };
}

function saoPauloParts(value: Date) {
  const shifted = new Date(value.getTime() - saoPauloOffsetMs);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay()
  };
}

function localSaoPauloToUtc(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(Date.UTC(year, month, day, hour + 3, minute, 0, 0));
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function nextResetAt(task: ResetTaskRow, after: Date) {
  if (task.reset_frequency === "none") return null;
  const { hour, minute } = parseTime(task.reset_time);
  const now = saoPauloParts(after);

  if (task.reset_frequency === "daily") {
    let candidate = localSaoPauloToUtc(now.year, now.month, now.day, hour, minute);
    if (candidate <= after) candidate = localSaoPauloToUtc(now.year, now.month, now.day + 1, hour, minute);
    return candidate.toISOString();
  }

  if (task.reset_frequency === "weekly") {
    const targetWeekday = task.reset_weekday ?? 0;
    let daysAhead = (targetWeekday - now.weekday + 7) % 7;
    let candidate = localSaoPauloToUtc(now.year, now.month, now.day + daysAhead, hour, minute);
    if (candidate <= after) {
      daysAhead += 7;
      candidate = localSaoPauloToUtc(now.year, now.month, now.day + daysAhead, hour, minute);
    }
    return candidate.toISOString();
  }

  const monthDay = task.reset_month_last_day
    ? lastDayOfMonth(now.year, now.month)
    : Math.min(task.reset_month_day ?? 1, lastDayOfMonth(now.year, now.month));
  let candidate = localSaoPauloToUtc(now.year, now.month, monthDay, hour, minute);
  if (candidate <= after) {
    const nextYear = now.month === 11 ? now.year + 1 : now.year;
    const nextMonth = (now.month + 1) % 12;
    const nextMonthDay = task.reset_month_last_day
      ? lastDayOfMonth(nextYear, nextMonth)
      : Math.min(task.reset_month_day ?? 1, lastDayOfMonth(nextYear, nextMonth));
    candidate = localSaoPauloToUtc(nextYear, nextMonth, nextMonthDay, hour, minute);
  }
  return candidate.toISOString();
}

async function childRows(client: ReturnType<typeof createClient<any, "public", any>>, table: string, taskId: string) {
  const { data, error } = await client.from(table).select("*").eq("task_id", taskId);
  if (error) throw error;
  return data ?? [];
}

function storagePathFromPublicUrl(bucket: string, value: string) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  if (!value.includes(marker)) return value.startsWith("http") ? "" : value;
  return decodeURIComponent(value.split(marker)[1] ?? "");
}

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

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const now = new Date();
  const nowIso = now.toISOString();
  const { data: tasks, error } = await client
    .from("tasks")
    .select("*")
    .neq("reset_frequency", "none")
    .not("next_reset_at", "is", null)
    .lte("next_reset_at", nowIso);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const processed: string[] = [];
  for (const task of (tasks ?? []) as ResetTaskRow[]) {
    const [assignees, checklist, comments, attachments] = await Promise.all([
      childRows(client, "task_assignees", task.id),
      childRows(client, "task_checklist_items", task.id),
      childRows(client, "task_comments", task.id),
      childRows(client, "task_attachments", task.id)
    ]);

    const snapshot = { task, assignees, checklist, comments, attachments };
    const { error: historyError } = await client.from("task_reset_history").insert({
      organization_id: task.organization_id,
      task_id: task.id,
      reset_source_id: task.id,
      frequency: task.reset_frequency,
      scheduled_for: task.next_reset_at,
      executed_at: nowIso,
      snapshot
    });
    if (historyError) throw historyError;

    const storagePaths = attachments
      .filter((attachment) => attachment.source === "upload")
      .map((attachment) => storagePathFromPublicUrl("task-attachments", attachment.storage_path || attachment.public_url || ""))
      .filter(Boolean);
    if (storagePaths.length) {
      const { error: storageError } = await client.storage.from("task-attachments").remove(storagePaths);
      if (storageError) console.warn("Nao foi possivel remover anexos do Storage durante o reset.", storageError);
    }

    const cleanup = await Promise.all([
      client.from("task_comments").delete().eq("task_id", task.id),
      client.from("task_attachments").delete().eq("task_id", task.id),
      client.from("task_checklist_items").update({ done: false }).eq("task_id", task.id)
    ]);
    const cleanupError = cleanup.find((result) => result.error)?.error;
    if (cleanupError) throw cleanupError;

    const { error: updateError } = await client.from("tasks").update({
      progress: "No prazo",
      last_reset_at: nowIso,
      next_reset_at: nextResetAt(task, now)
    }).eq("id", task.id);
    if (updateError) throw updateError;
    processed.push(task.id);
  }

  return NextResponse.json({ processed: processed.length, taskIds: processed });
}

export const POST = GET;
