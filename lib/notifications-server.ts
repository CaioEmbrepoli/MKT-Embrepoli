import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Notification } from "./types";

type NotificationRecipientMode = "admins_managers" | "marketing" | "all_active";

type CreateNotificationInput = {
  organizationId: string;
  userIds?: string[];
  recipientMode?: NotificationRecipientMode;
  title: string;
  description?: string;
  category?: Notification["category"];
  priority?: Notification["priority"];
  source?: string;
  eventKey: string;
  targetKind?: Notification["targetKind"];
  targetId?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

async function recipientsForMode(service: SupabaseClient, organizationId: string, mode: NotificationRecipientMode) {
  let query = service
    .from("profiles")
    .select("id,role,active")
    .eq("organization_id", organizationId)
    .eq("active", true);

  if (mode === "admins_managers") query = query.in("role", ["admin", "gestor"]);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((profile) => String(profile.id)).filter(Boolean);
}

export async function upsertInternalNotifications(service: SupabaseClient, input: CreateNotificationInput) {
  const explicitUserIds = input.userIds?.filter(Boolean) ?? [];
  const userIds = Array.from(new Set(explicitUserIds.length
    ? explicitUserIds
    : await recipientsForMode(service, input.organizationId, input.recipientMode ?? "admins_managers")));
  if (!userIds.length) return { count: 0 };

  const createdAt = input.createdAt ?? new Date().toISOString();
  const eventKeyBase = input.eventKey.trim() || crypto.randomUUID();
  const rows = userIds.map((userId) => ({
    id: `notification:${eventKeyBase}:${userId}`,
    organization_id: input.organizationId,
    user_id: userId,
    title: input.title,
    description: input.description ?? "",
    read: false,
    target_kind: input.targetKind ?? "system",
    target_id: input.targetId ?? eventKeyBase,
    category: input.category ?? "system",
    priority: input.priority ?? "normal",
    source: input.source ?? null,
    event_key: eventKeyBase,
    action_label: input.actionLabel ?? null,
    metadata: input.metadata ?? {},
    created_at: createdAt,
    archived_at: null,
    read_at: null
  }));

  const { error } = await service
    .from("notifications")
    .upsert(rows, { onConflict: "id" });
  if (error) throw error;
  return { count: rows.length };
}
