import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Campaign,
  CampaignAudience,
  CalendarDate,
  Channel,
  ChecklistItem,
  ContentType,
  EditorialPost,
  FunnelStage,
  Idea,
  Notification,
  PostReviewAsset,
  PostReviewComment,
  PostMetric,
  PostMetricSnapshot,
  PostTemplate,
  ProductLine,
  Profile,
  Task,
  TaskAttachment,
  TaskBoard,
  TaskColumn,
  TaskComment,
  VehicleType
} from "./types";

export type AppData = {
  profiles: Profile[];
  channels: Channel[];
  productLines: ProductLine[];
  vehicleTypes: VehicleType[];
  contentTypes: ContentType[];
  funnelStages: FunnelStage[];
  taskBoards: TaskBoard[];
  taskColumns: TaskColumn[];
  campaigns: Campaign[];
  campaignAudiences: CampaignAudience[];
  postTemplates: PostTemplate[];
  posts: EditorialPost[];
  postReviewAssets: PostReviewAsset[];
  ideas: Idea[];
  tasks: Task[];
  metrics: PostMetric[];
  notifications: Notification[];
  calendarDates: CalendarDate[];
};

const EMBREPOLI_ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function ensureCurrentProfile(client: SupabaseClient): Promise<Profile | null> {
  const { data } = await client.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const existing = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (existing.data) return mapProfile(existing.data);

  const profile = {
    id: user.id,
    organization_id: EMBREPOLI_ORG_ID,
    name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Novo usuário",
    email: user.email ?? "",
    phone: "",
    bio: "",
    role: "colaborador",
    avatar_url: "",
    active: false,
    notification_sound: true
  };
  const created = await client.from("profiles").insert(profile).select("*").single();
  return created.data ? mapProfile(created.data) : null;
}

export async function loadAppData(client: SupabaseClient): Promise<AppData> {
  const profile = await ensureCurrentProfile(client);
  const organizationId = profile?.id ? await getOrganizationId(client, profile.id) : EMBREPOLI_ORG_ID;

  const [
    profiles,
    channels,
    productLines,
    vehicleTypes,
    contentTypes,
    funnelStages,
    taskBoards,
    taskColumns,
    campaigns,
    campaignAudiences,
    postTemplates,
    campaignAssignees,
    posts,
    postAssignees,
    reviewAssets,
    reviewComments,
    ideas,
    tasks,
    taskAssignees,
    checklist,
    comments,
    attachments,
    metrics,
    notifications,
    calendarDates,
    ideaAttachments
  ] = await Promise.all([
    client.from("profiles").select("*").eq("organization_id", organizationId),
    client.from("channels").select("*").eq("organization_id", organizationId),
    client.from("product_lines").select("*").eq("organization_id", organizationId),
    client.from("vehicle_types").select("*").eq("organization_id", organizationId),
    client.from("content_types").select("*").eq("organization_id", organizationId),
    client.from("funnel_stages").select("*").eq("organization_id", organizationId),
    client.from("task_boards").select("*").eq("organization_id", organizationId),
    client.from("task_columns").select("*").eq("organization_id", organizationId),
    client.from("campaigns").select("*").eq("organization_id", organizationId),
    client.from("campaign_audiences").select("*").eq("organization_id", organizationId),
    client.from("post_templates").select("*").eq("organization_id", organizationId),
    client.from("campaign_assignees").select("*").eq("organization_id", organizationId),
    client.from("posts").select("*").eq("organization_id", organizationId),
    client.from("post_assignees").select("*").eq("organization_id", organizationId),
    client.from("post_review_assets").select("*").eq("organization_id", organizationId),
    client.from("post_review_comments").select("*").eq("organization_id", organizationId),
    client.from("ideas").select("*").eq("organization_id", organizationId),
    client.from("tasks").select("*").eq("organization_id", organizationId),
    client.from("task_assignees").select("*").eq("organization_id", organizationId),
    client.from("task_checklist_items").select("*").eq("organization_id", organizationId),
    client.from("task_comments").select("*").eq("organization_id", organizationId),
    client.from("task_attachments").select("*").eq("organization_id", organizationId),
    client.from("post_metrics").select("*").eq("organization_id", organizationId),
    client.from("notifications").select("*").eq("organization_id", organizationId),
    client.from("calendar_dates").select("*").eq("organization_id", organizationId),
    client.from("idea_attachments").select("*").eq("organization_id", organizationId)
  ]);

  const campaignAssigneeMap = groupByParent(campaignAssignees.data ?? [], "campaign_id");
  const postAssigneeMap = groupByParent(postAssignees.data ?? [], "post_id");
  const reviewCommentMap = groupByParent(reviewComments.data ?? [], "asset_id");
  const taskAssigneeMap = groupByParent(taskAssignees.data ?? [], "task_id");
  const checklistMap = groupByParent(checklist.data ?? [], "task_id");
  const commentsMap = groupByParent(comments.data ?? [], "task_id");
  const attachmentsMap = groupByParent(attachments.data ?? [], "task_id");
  const ideaAttachmentMap = groupByParent(ideaAttachments.data ?? [], "idea_id");

  return {
    profiles: (profiles.data ?? []).map(mapProfile),
    channels: (channels.data ?? []).map(mapChannel),
    productLines: (productLines.data ?? []).map(mapProductLine),
    vehicleTypes: (vehicleTypes.data ?? []).map(mapVehicleType),
    contentTypes: (contentTypes.data ?? []).map(mapContentType),
    funnelStages: (funnelStages.data ?? []).map(mapFunnelStage),
    taskBoards: (taskBoards.data ?? []).map(mapTaskBoard),
    taskColumns: (taskColumns.data ?? []).map(mapTaskColumn),
    campaigns: (campaigns.data ?? []).map((item) => mapCampaign(item, campaignAssigneeMap.get(item.id) ?? [])),
    campaignAudiences: (campaignAudiences.data ?? []).map(mapCampaignAudience),
    postTemplates: (postTemplates.data ?? []).map(mapPostTemplate),
    posts: (posts.data ?? []).map((item) => mapPost(item, postAssigneeMap.get(item.id) ?? [])),
    postReviewAssets: (reviewAssets.data ?? []).map((item) => mapReviewAsset(item, reviewCommentMap.get(item.id) ?? [])),
    ideas: (ideas.data ?? []).map((item) => mapIdea(item, ideaAttachmentMap.get(item.id) ?? [])),
    tasks: (tasks.data ?? []).map((item) => mapTask(item, taskAssigneeMap.get(item.id) ?? [], checklistMap.get(item.id) ?? [], commentsMap.get(item.id) ?? [], attachmentsMap.get(item.id) ?? [])),
    metrics: (metrics.data ?? []).map(mapMetric),
    notifications: (notifications.data ?? []).map(mapNotification),
    calendarDates: (calendarDates.data ?? []).map(mapCalendarDate)
  };
}

export async function replaceProfiles(client: SupabaseClient, profiles: Profile[], previous: Profile[] = []) {
  const organizationId = await currentOrganizationId(client);
  await deleteRemovedRows(client, "profiles", organizationId, previous, profiles);
  const { error } = await client.from("profiles").upsert(profiles.map((profile) => ({
    id: profile.id,
    organization_id: organizationId,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    bio: profile.bio,
    role: profile.role,
    avatar_url: profile.avatarUrl,
    active: profile.active,
    notification_sound: profile.notificationSound
  })));
  if (error) throw new Error(`profiles upsert: ${error.message}`);
}

export async function saveProfile(client: SupabaseClient, profile: Profile) {
  await replaceProfiles(client, [profile], [profile]);
}

export async function deleteProfile(client: SupabaseClient, id: string) {
  await deleteById(client, "profiles", id);
}

export async function replaceChannels(client: SupabaseClient, channels: Channel[], previous: Channel[] = []) {
  await replaceSimple(client, "channels", channels, previous, (item, organizationId) => ({ id: item.id, organization_id: organizationId, name: item.name, color: item.color }));
}

export async function saveChannel(client: SupabaseClient, channel: Channel) {
  await replaceChannels(client, [channel], [channel]);
}

export async function deleteChannel(client: SupabaseClient, id: string) {
  await deleteById(client, "channels", id);
}

export async function replaceProductLines(client: SupabaseClient, productLines: ProductLine[], previous: ProductLine[] = []) {
  await replaceSimple(client, "product_lines", productLines, previous, (item, organizationId) => ({ id: item.id, organization_id: organizationId, name: item.name }));
}

export async function saveProductLine(client: SupabaseClient, productLine: ProductLine) {
  await replaceProductLines(client, [productLine], [productLine]);
}

export async function deleteProductLine(client: SupabaseClient, id: string) {
  await deleteById(client, "product_lines", id);
}

export async function replaceVehicleTypes(client: SupabaseClient, vehicleTypes: VehicleType[], previous: VehicleType[] = []) {
  await replaceSimple(client, "vehicle_types", vehicleTypes, previous, (item, organizationId) => ({ id: item.id, organization_id: organizationId, name: item.name }));
}

export async function saveVehicleType(client: SupabaseClient, vehicleType: VehicleType) {
  await replaceVehicleTypes(client, [vehicleType], [vehicleType]);
}

export async function deleteVehicleType(client: SupabaseClient, id: string) {
  await deleteById(client, "vehicle_types", id);
}

export async function replaceContentTypes(client: SupabaseClient, contentTypes: ContentType[], previous: ContentType[] = []) {
  await replaceSimple(client, "content_types", contentTypes, previous, (item, organizationId) => ({ id: item.id, organization_id: organizationId, name: item.name }));
}

export async function saveContentType(client: SupabaseClient, contentType: ContentType) {
  await replaceContentTypes(client, [contentType], [contentType]);
}

export async function deleteContentType(client: SupabaseClient, id: string) {
  await deleteById(client, "content_types", id);
}

export async function replaceFunnelStages(client: SupabaseClient, stages: FunnelStage[], previous: FunnelStage[] = []) {
  await replaceSimple(client, "funnel_stages", stages, previous, (item, organizationId) => ({ id: item.id, organization_id: organizationId, name: item.name, color: item.color, sort_order: item.order }));
}

export async function saveFunnelStage(client: SupabaseClient, stage: FunnelStage) {
  await replaceFunnelStages(client, [stage], [stage]);
}

export async function deleteFunnelStage(client: SupabaseClient, id: string) {
  await deleteById(client, "funnel_stages", id);
}

export async function replaceTaskBoards(client: SupabaseClient, boards: TaskBoard[], previous: TaskBoard[] = []) {
  await replaceSimple(client, "task_boards", boards, previous, (item, organizationId) => ({ id: item.id, organization_id: organizationId, name: item.name, sort_order: item.order, is_fixed: item.isFixed }));
}

export async function saveTaskBoard(client: SupabaseClient, board: TaskBoard) {
  await replaceTaskBoards(client, [board], [board]);
}

export async function deleteTaskBoard(client: SupabaseClient, id: string) {
  await deleteById(client, "task_boards", id);
}

export async function replaceTaskColumns(client: SupabaseClient, columns: TaskColumn[], previous: TaskColumn[] = []) {
  await replaceSimple(client, "task_columns", columns, previous, (item, organizationId) => ({ id: item.id, organization_id: organizationId, task_board_id: item.boardId, name: item.name, color: item.color, sort_order: item.order }));
}

export async function saveTaskColumn(client: SupabaseClient, column: TaskColumn) {
  await replaceTaskColumns(client, [column], [column]);
}

export async function deleteTaskColumn(client: SupabaseClient, id: string) {
  await deleteById(client, "task_columns", id);
}

export async function replaceIdeas(client: SupabaseClient, ideas: Idea[], previous: Idea[] = []) {
  const organizationId = await currentOrganizationId(client);
  await replaceSimpleWithOrg(client, "ideas", organizationId, ideas, previous, (item) => ({
    id: item.id,
    organization_id: organizationId,
    channel_id: item.channelId,
    product_line_id: item.productLineId,
    vehicle_type_id: item.vehicleTypeId,
    content_type_id: item.contentTypeId,
    funnel_stage_id: item.funnelStageId || null,
    template_id: item.templateId || null,
    created_by: item.createdBy,
    title: item.title,
    description: item.description,
    type: item.type,
    format: item.format || "Post",
    priority: item.priority,
    sort_order: item.order
  }));
  await replaceChildRows(client, "idea_attachments", "idea_id", organizationId, ideas.map((idea) => idea.id), ideas.flatMap((idea) => (idea.attachments ?? []).map((item) => ({
    id: item.id,
    organization_id: organizationId,
    idea_id: idea.id,
    uploaded_by: idea.createdBy,
    name: item.name,
    file_type: item.type,
    source: item.source,
    storage_path: item.url,
    public_url: item.url,
    preview_url: item.previewUrl,
    original_size: item.originalSize,
    compressed_size: item.compressedSize,
    mime_type: item.mimeType
  }))));
}

export async function saveIdea(client: SupabaseClient, idea: Idea) {
  await replaceIdeas(client, [idea], [idea]);
}

export async function deleteIdea(client: SupabaseClient, id: string) {
  await deleteById(client, "ideas", id);
}

export async function replaceCampaigns(client: SupabaseClient, campaigns: Campaign[], previous: Campaign[] = []) {
  const organizationId = await currentOrganizationId(client);
  await replaceSimpleWithOrg(client, "campaigns", organizationId, campaigns, previous, (item) => ({
    id: item.id,
    organization_id: organizationId,
    product_line_id: item.productLineId || null,
    vehicle_type_id: item.vehicleTypeId || null,
    funnel_stage_id: item.funnelStageId || null,
    created_by: item.createdBy,
    name: item.name,
    objective: item.objective,
    audience: item.audience,
    message: item.message,
    start_date: item.startDate || null,
    end_date: item.endDate || null,
    status: item.status
  }));
  await replaceAssignees(client, "campaign_assignees", "campaign_id", organizationId, campaigns.map((item) => ({ parentId: item.id, assignees: item.assignedTo })));
}

export async function saveCampaign(client: SupabaseClient, campaign: Campaign) {
  await replaceCampaigns(client, [campaign], [campaign]);
}

export async function deleteCampaign(client: SupabaseClient, id: string) {
  await deleteById(client, "campaigns", id);
}

export async function replaceCampaignAudiences(client: SupabaseClient, audiences: CampaignAudience[], previous: CampaignAudience[] = []) {
  await replaceSimple(client, "campaign_audiences", audiences, previous, (item, organizationId) => ({ id: item.id, organization_id: organizationId, name: item.name }));
}

export async function saveCampaignAudience(client: SupabaseClient, audience: CampaignAudience) {
  await replaceCampaignAudiences(client, [audience], [audience]);
}

export async function deleteCampaignAudience(client: SupabaseClient, id: string) {
  await deleteById(client, "campaign_audiences", id);
}

export async function replacePostTemplates(client: SupabaseClient, templates: PostTemplate[], previous: PostTemplate[] = []) {
  await replaceSimple(client, "post_templates", templates, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    name: item.name,
    description: item.description,
    content_type_id: item.contentTypeId || null,
    channel_id: item.channelId || null,
    format: item.format,
    suggested_time: item.suggestedTime || "",
    funnel_stage_id: item.funnelStageId || null,
    structure: item.structure,
    checklist: item.checklist,
    structure_items: item.structureItems ?? [],
    checklist_items: item.checklistItems ?? [],
    visual_guidance: item.visualGuidance,
    caption_example: item.captionExample
  }));
}

export async function savePostTemplate(client: SupabaseClient, template: PostTemplate) {
  await replacePostTemplates(client, [template], [template]);
}

export async function deletePostTemplate(client: SupabaseClient, id: string) {
  await deleteById(client, "post_templates", id);
}

export async function replacePosts(client: SupabaseClient, posts: EditorialPost[], previous: EditorialPost[] = []) {
  const organizationId = await currentOrganizationId(client);
  await replaceSimpleWithOrg(client, "posts", organizationId, posts, previous, (item) => ({
    id: item.id,
    organization_id: organizationId,
    channel_id: item.channelId || null,
    campaign_id: item.campaignId || null,
    product_line_id: item.productLineId || null,
    vehicle_type_id: item.vehicleTypeId || null,
    content_type_id: item.contentTypeId || null,
    funnel_stage_id: item.funnelStageId || null,
    idea_id: item.ideaId || null,
    template_id: item.templateId || null,
    created_by: item.createdBy,
    title: item.title,
    status: item.status,
    format: item.format,
    sort_order: item.order ?? 1,
    publish_at: item.publishAt,
    description: item.description,
    production_checklist: item.productionChecklist ?? [],
    published_video_id: item.publishedVideoId ?? null,
    published_at: item.publishedAt ?? null
  }));
  await replaceAssignees(client, "post_assignees", "post_id", organizationId, posts.map((item) => ({ parentId: item.id, assignees: item.assignedTo })));
}

export async function savePost(client: SupabaseClient, post: EditorialPost) {
  await replacePosts(client, [post], [post]);
}

export async function deletePost(client: SupabaseClient, id: string) {
  await deleteById(client, "posts", id);
}

export async function replacePostReviewAssets(client: SupabaseClient, assets: PostReviewAsset[], previous: PostReviewAsset[] = []) {
  const organizationId = await currentOrganizationId(client);
  await replaceSimpleWithOrg(client, "post_review_assets", organizationId, assets, previous, (item) => ({
    id: item.id,
    organization_id: organizationId,
    post_id: item.postId,
    uploaded_by: item.uploadedBy,
    reviewed_by: item.reviewedBy || null,
    name: item.name,
    file_type: item.type,
    source: item.source,
    storage_path: item.url,
    public_url: item.url,
    preview_url: item.previewUrl,
    original_size: item.originalSize,
    compressed_size: item.compressedSize,
    mime_type: item.mimeType,
    status: item.status,
    uploaded_at: item.uploadedAt,
    reviewed_at: item.reviewedAt || null
  }));
  await replaceChildRows(client, "post_review_comments", "asset_id", organizationId, assets.map((asset) => asset.id), assets.flatMap((asset) => asset.comments.map((comment) => ({
    id: comment.id,
    organization_id: organizationId,
    asset_id: asset.id,
    post_id: asset.postId,
    author_id: comment.authorId,
    message: comment.message,
    created_at: comment.createdAt
  }))));
}

export async function savePostReviewAsset(client: SupabaseClient, asset: PostReviewAsset) {
  await replacePostReviewAssets(client, [asset], [asset]);
}

export async function deletePostReviewAsset(client: SupabaseClient, id: string) {
  await deleteById(client, "post_review_assets", id);
}

export async function replaceTasks(client: SupabaseClient, tasks: Task[], previous: Task[] = []) {
  const organizationId = await currentOrganizationId(client);
  await replaceSimpleWithOrg(client, "tasks", organizationId, tasks, previous, (item) => ({
    id: item.id,
    organization_id: organizationId,
    parent_task_id: item.parentTaskId ?? null,
    task_column_id: item.columnId,
    funnel_stage_id: item.funnelStageId,
    created_by: item.createdBy,
    title: item.title,
    priority: item.priority,
    progress: item.progress,
    related_to: item.relatedTo,
    description: item.description,
    due_date: item.dueDate,
    sort_order: item.order,
    reset_frequency: item.resetFrequency ?? "none",
    reset_time: item.resetTime ?? "23:59",
    reset_weekday: item.resetWeekday ?? null,
    reset_month_day: item.resetMonthDay ?? null,
    reset_month_last_day: item.resetMonthLastDay ?? false,
    fixed_goal_key: item.fixedGoalKey ?? null,
    last_reset_at: item.lastResetAt ?? null,
    next_reset_at: item.nextResetAt ?? null
  }));
  await replaceAssignees(client, "task_assignees", "task_id", organizationId, tasks.map((item) => ({ parentId: item.id, assignees: item.assignedTo })));
  await replaceChildRows(client, "task_checklist_items", "task_id", organizationId, tasks.map((task) => task.id), tasks.flatMap((task) => task.checklist.map((item, index) => ({ id: item.id, organization_id: organizationId, task_id: task.id, label: item.label, done: item.done, sort_order: index + 1 }))));
  await replaceChildRows(client, "task_comments", "task_id", organizationId, tasks.map((task) => task.id), tasks.flatMap((task) => task.comments.map((item) => ({ id: item.id, organization_id: organizationId, task_id: task.id, author_id: item.authorId, message: item.message, created_at: item.createdAt }))));
  await replaceChildRows(client, "task_attachments", "task_id", organizationId, tasks.map((task) => task.id), tasks.flatMap((task) => task.attachments.map((item) => ({ id: item.id, organization_id: organizationId, task_id: task.id, uploaded_by: task.createdBy, name: item.name, file_type: item.type, source: item.source, storage_path: item.url, public_url: item.url, preview_url: item.previewUrl, original_size: item.originalSize, compressed_size: item.compressedSize, mime_type: item.mimeType }))));
}

export async function saveTask(client: SupabaseClient, task: Task) {
  await replaceTasks(client, [task], [task]);
}

export async function deleteTask(client: SupabaseClient, id: string) {
  await deleteById(client, "tasks", id);
}

export async function replaceMetrics(client: SupabaseClient, metrics: PostMetric[], previous: PostMetric[] = []) {
  await replaceSimple(client, "post_metrics", metrics, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    external_id: item.externalId ?? null,
    post_id: item.postId || null,
    post_title: item.postTitle,
    channel_id: item.channelId,
    campaign_id: item.campaignId || null,
    product_line_id: item.productLineId,
    vehicle_type_id: item.vehicleTypeId || null,
    content_type_id: item.contentTypeId || null,
    funnel_stage_id: item.funnelStageId,
    metric_date: item.date,
    reach: item.reach,
    likes: item.likes,
    comments: item.comments,
    shares: item.shares,
    clicks: item.clicks,
    leads: item.leads,
    notes: item.notes,
    learning: item.learning,
    video_type: item.videoType ?? null,
    privacy_status: item.privacyStatus ?? null
  }));
}

export async function saveMetric(client: SupabaseClient, metric: PostMetric) {
  await replaceMetrics(client, [metric], [metric]);
}

export async function deleteMetric(client: SupabaseClient, id: string) {
  await deleteById(client, "post_metrics", id);
}

export async function saveMetricSnapshots(
  client: SupabaseClient,
  snapshots: PostMetricSnapshot[]
) {
  if (!snapshots.length) return;
  const organizationId = await currentOrganizationId(client);
  const rows = snapshots.map((s) => ({
    id: s.id,
    organization_id: organizationId,
    metric_id: s.metricId,
    captured_at: s.capturedAt,
    reach: s.reach,
    likes: s.likes,
    comments: s.comments,
    shares: s.shares,
    clicks: s.clicks,
    leads: s.leads,
  }));
  const { error } = await client.from("post_metric_snapshots").insert(rows);
  if (error) throw new Error(`post_metric_snapshots insert: ${error.message}`);
}

export async function replaceNotifications(client: SupabaseClient, notifications: Notification[], previous: Notification[] = []) {
  await replaceSimple(client, "notifications", notifications, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    user_id: item.userId,
    title: item.title,
    description: item.description,
    created_at: item.createdAt,
    read: item.read,
    target_kind: item.targetKind,
    target_id: item.targetId
  }));
}

export async function saveNotification(client: SupabaseClient, notification: Notification) {
  await replaceNotifications(client, [notification], [notification]);
}

export async function deleteNotification(client: SupabaseClient, id: string) {
  await deleteById(client, "notifications", id);
}

export async function replaceCalendarDates(client: SupabaseClient, calendarDates: CalendarDate[], previous: CalendarDate[] = []) {
  await replaceSimple(client, "calendar_dates", calendarDates, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    name: item.name,
    date: item.date || null,
    type: item.type,
    color: item.color,
    notes: item.notes
  }));
}

export async function saveCalendarDate(client: SupabaseClient, calendarDate: CalendarDate) {
  await replaceCalendarDates(client, [calendarDate], [calendarDate]);
}

export async function deleteCalendarDate(client: SupabaseClient, id: string) {
  await deleteById(client, "calendar_dates", id);
}

async function replaceSimple<T extends { id: string }>(client: SupabaseClient, table: string, rows: T[], previous: T[], mapper: (row: T, organizationId: string) => Record<string, unknown>) {
  const organizationId = await currentOrganizationId(client);
  await replaceSimpleWithOrg(client, table, organizationId, rows, previous, (row) => mapper(row, organizationId));
}

async function replaceSimpleWithOrg<T extends { id: string }>(client: SupabaseClient, table: string, organizationId: string, rows: T[], previous: T[], mapper: (row: T) => Record<string, unknown>) {
  await deleteRemovedRows(client, table, organizationId, previous, rows);
  if (rows.length) {
    const { error } = await client.from(table).upsert(rows.map(mapper));
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
}

async function replaceAssignees(client: SupabaseClient, table: string, parentColumn: string, organizationId: string, rows: { parentId: string; assignees: string[] }[]) {
  const parentIds = rows.map((row) => row.parentId);
  if (parentIds.length) await client.from(table).delete().eq("organization_id", organizationId).in(parentColumn, parentIds);
  const payload = rows.flatMap((row) => row.assignees.map((profileId) => ({ organization_id: organizationId, [parentColumn]: row.parentId, profile_id: profileId })));
  if (payload.length) await client.from(table).insert(payload);
}

async function replaceChildRows(client: SupabaseClient, table: string, parentColumn: string, organizationId: string, parentIds: string[], rows: Record<string, unknown>[]) {
  parentIds = Array.from(new Set(parentIds.filter(Boolean)));
  if (parentIds.length) await client.from(table).delete().eq("organization_id", organizationId).in(parentColumn, parentIds);
  if (rows.length) await client.from(table).upsert(rows);
}

async function deleteRemovedRows<T extends { id: string }>(client: SupabaseClient, table: string, organizationId: string, previous: T[], next: T[]) {
  const nextIds = new Set(next.map((row) => row.id));
  const removedIds = previous.map((row) => row.id).filter((id) => !nextIds.has(id));
  if (removedIds.length) await client.from(table).delete().eq("organization_id", organizationId).in("id", removedIds);
}

async function deleteById(client: SupabaseClient, table: string, id: string) {
  const organizationId = await currentOrganizationId(client);
  await client.from(table).delete().eq("organization_id", organizationId).eq("id", id);
}

async function currentOrganizationId(client: SupabaseClient) {
  const { data } = await client.auth.getUser();
  if (!data.user) return EMBREPOLI_ORG_ID;
  return getOrganizationId(client, data.user.id);
}

async function getOrganizationId(client: SupabaseClient, profileId: string) {
  const { data } = await client.from("profiles").select("organization_id").eq("id", profileId).maybeSingle();
  return data?.organization_id ?? EMBREPOLI_ORG_ID;
}

function groupByParent(rows: Record<string, any>[], parentKey: string) {
  const map = new Map<string, Record<string, any>[]>();
  for (const row of rows) {
    const key = String(row[parentKey]);
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

function quote(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function textLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
}

function mapProfile(row: any): Profile {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone ?? "", bio: row.bio ?? "", role: row.role, avatarUrl: row.avatar_url ?? "", active: row.active ?? true, notificationSound: row.notification_sound ?? true };
}

function mapChannel(row: any): Channel {
  return { id: row.id, name: row.name, color: row.color };
}

function mapProductLine(row: any): ProductLine {
  return { id: row.id, name: row.name };
}

function mapVehicleType(row: any): VehicleType {
  return { id: row.id, name: row.name };
}

function mapContentType(row: any): ContentType {
  return { id: row.id, name: row.name };
}

function mapFunnelStage(row: any): FunnelStage {
  return { id: row.id, name: row.name, color: row.color, order: row.sort_order };
}

function mapTaskBoard(row: any): TaskBoard {
  return { id: row.id, name: row.name, order: row.sort_order, isFixed: row.is_fixed };
}

function mapTaskColumn(row: any): TaskColumn {
  return { id: row.id, boardId: row.task_board_id, name: row.name, color: row.color, order: row.sort_order };
}

function mapCampaign(row: any, assignees: any[]): Campaign {
  return { id: row.id, name: row.name, objective: row.objective, audience: row.audience, message: row.message, productLineId: row.product_line_id ?? "", vehicleTypeId: row.vehicle_type_id ?? "", funnelStageId: row.funnel_stage_id ?? "", createdBy: row.created_by ?? "", assignedTo: assignees.map((item) => item.profile_id), startDate: row.start_date ?? "", endDate: row.end_date ?? "", status: row.status };
}

function mapCampaignAudience(row: any): CampaignAudience {
  return { id: row.id, name: row.name };
}

function mapPostTemplate(row: any): PostTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    contentTypeId: row.content_type_id ?? "",
    channelId: row.channel_id ?? "",
    format: row.format ?? "",
    suggestedTime: row.suggested_time ?? "",
    funnelStageId: row.funnel_stage_id ?? "",
    structure: row.structure ?? "",
    checklist: row.checklist ?? "",
    structureItems: row.structure_items?.length ? row.structure_items : textLines(row.structure ?? ""),
    checklistItems: row.checklist_items?.length ? row.checklist_items : textLines(row.checklist ?? "").map((label, index) => ({ id: `${row.id}-check-${index + 1}`, label, done: false })),
    visualGuidance: row.visual_guidance ?? "",
    captionExample: row.caption_example ?? ""
  };
}

function mapPost(row: any, assignees: any[]): EditorialPost {
  return { id: row.id, ideaId: row.idea_id ?? "", templateId: row.template_id ?? "", title: row.title, channelId: row.channel_id ?? "", campaignId: row.campaign_id ?? "", productLineId: row.product_line_id ?? "", vehicleTypeId: row.vehicle_type_id ?? "", contentTypeId: row.content_type_id ?? "", funnelStageId: row.funnel_stage_id ?? "", createdBy: row.created_by ?? "", assignedTo: assignees.map((item) => item.profile_id), status: row.status, format: row.format ?? "Post", order: row.sort_order ?? 1, publishAt: String(row.publish_at ?? "").slice(0, 16), description: row.description ?? "", productionChecklist: row.production_checklist ?? [], publishedVideoId: row.published_video_id ?? undefined, publishedAt: row.published_at ?? undefined };
}

function mapReviewAsset(row: any, comments: any[]): PostReviewAsset {
  return {
    id: row.id,
    postId: row.post_id,
    name: row.name,
    type: row.file_type,
    source: row.source ?? "upload",
    url: row.public_url || row.storage_path,
    previewUrl: row.preview_url || row.public_url || row.storage_path,
    originalSize: row.original_size ?? 0,
    compressedSize: row.compressed_size ?? row.original_size ?? 0,
    mimeType: row.mime_type ?? "",
    status: row.status,
    uploadedBy: row.uploaded_by ?? "",
    reviewedBy: row.reviewed_by ?? "",
    uploadedAt: row.uploaded_at ?? row.created_at,
    reviewedAt: row.reviewed_at ?? "",
    comments: comments.map((item): PostReviewComment => ({
      id: item.id,
      assetId: item.asset_id,
      authorId: item.author_id,
      message: item.message,
      createdAt: item.created_at
    }))
  };
}

function mapIdea(row: any, attachments: any[]): Idea {
  return {
    id: row.id,
    templateId: row.template_id ?? "",
    title: row.title,
    description: row.description ?? "",
    productLineId: row.product_line_id ?? "",
    vehicleTypeId: row.vehicle_type_id ?? "",
    contentTypeId: row.content_type_id ?? "",
    type: row.type,
    channelId: row.channel_id ?? "",
    format: row.format ?? "Post",
    funnelStageId: row.funnel_stage_id ?? "",
    createdBy: row.created_by ?? "",
    priority: row.priority,
    order: row.sort_order ?? 1,
    attachments: attachments.map(mapFileAttachment)
  };
}

function mapTask(row: any, assignees: any[], checklist: any[], comments: any[], attachments: any[]): Task {
  return {
    id: row.id,
    title: row.title,
    columnId: row.task_column_id ?? "",
    order: row.sort_order,
    priority: row.priority,
    progress: row.progress,
    createdBy: row.created_by ?? "",
    assignedTo: assignees.map((item) => item.profile_id),
    relatedTo: row.related_to ?? "",
    funnelStageId: row.funnel_stage_id ?? "",
    parentTaskId: row.parent_task_id ?? undefined,
    dueDate: row.due_date ?? "",
    description: row.description ?? "",
    checklist: checklist.sort((a, b) => a.sort_order - b.sort_order).map((item): ChecklistItem => ({ id: item.id, label: item.label, done: item.done })),
    comments: comments.map((item): TaskComment => ({ id: item.id, authorId: item.author_id, message: item.message, createdAt: item.created_at })),
    attachments: attachments.map(mapFileAttachment),
    resetFrequency: row.reset_frequency ?? "none",
    resetTime: row.reset_time ?? "23:59",
    resetWeekday: row.reset_weekday ?? undefined,
    resetMonthDay: row.reset_month_day ?? undefined,
    resetMonthLastDay: row.reset_month_last_day ?? false,
    fixedGoalKey: row.fixed_goal_key ?? undefined,
    lastResetAt: row.last_reset_at ?? undefined,
    nextResetAt: row.next_reset_at ?? undefined
  };
}

function mapMetric(row: any): PostMetric {
  return {
    id: row.id,
    externalId: row.external_id ?? undefined,
    postId: row.post_id ?? undefined,
    postTitle: row.post_title,
    channelId: row.channel_id ?? "",
    campaignId: row.campaign_id ?? "",
    productLineId: row.product_line_id ?? "",
    vehicleTypeId: row.vehicle_type_id ?? "",
    contentTypeId: row.content_type_id ?? "",
    funnelStageId: row.funnel_stage_id ?? "",
    date: row.metric_date ?? row.created_at?.slice(0, 10) ?? "",
    reach: row.reach,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    clicks: row.clicks,
    leads: row.leads,
    notes: row.notes ?? "",
    learning: row.learning ?? "",
    videoType: row.video_type ?? undefined,
    privacyStatus: row.privacy_status ?? undefined
  };
}

function mapNotification(row: any): Notification {
  return { id: row.id, userId: row.user_id, title: row.title, description: row.description, createdAt: row.created_at, read: row.read, targetKind: row.target_kind, targetId: row.target_id };
}

function mapCalendarDate(row: any): CalendarDate {
  return { id: row.id, name: row.name, date: row.date ?? "", type: row.type ?? "Data comemorativa", color: row.color ?? "#2563eb", notes: row.notes ?? "" };
}

function mapFileAttachment(item: any): TaskAttachment {
  return { id: item.id, name: item.name, type: item.file_type, source: item.source ?? "upload", url: item.public_url || item.storage_path, previewUrl: item.preview_url || item.public_url || item.storage_path, originalSize: item.original_size ?? 0, compressedSize: item.compressed_size ?? item.original_size ?? 0, mimeType: item.mime_type ?? "" };
}

