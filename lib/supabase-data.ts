import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AutoFilter,
  Ad,
  AdAccount,
  AdAlert,
  AdCampaign,
  AdInsightDaily,
  AdSet,
  Campaign,
  CampaignAudience,
  CalendarDate,
  Channel,
  ChecklistItem,
  Comment,
  ContentType,
  CustomerQuestion,
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
  ProfileArea,
  ProfileModulePermission,
  Task,
  TaskAttachment,
  TaskBoard,
  TaskColumn,
  TaskComment,
  VehicleType,
  SalesClient,
  SalesProposal,
  CallSchedule,
  CallLog,
  CallFrequency,
  SalesFunnelStage,
  PostPublication
} from "./types";

export type AppData = {
  profiles: Profile[];
  profileAreas: ProfileArea[];
  profileModulePermissions: ProfileModulePermission[];
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
  adAccounts: AdAccount[];
  adCampaigns: AdCampaign[];
  adSets: AdSet[];
  ads: Ad[];
  adInsightsDaily: AdInsightDaily[];
  adAlerts: AdAlert[];
  notifications: Notification[];
  calendarDates: CalendarDate[];
  customerQuestions: CustomerQuestion[];
  ytComments: Comment[];
  autoFilters: AutoFilter[];
  salesClients: SalesClient[];
  salesFunnelStages: SalesFunnelStage[];
  callSchedules: CallSchedule[];
  postPublications: PostPublication[];
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
    profileAreas,
    profileModulePermissions,
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
    ideaAttachments,
    customerQuestions,
    ytCommentsData,
    autoFiltersData,
    salesClientsData,
    salesFunnelStagesData,
    callSchedulesData,
    postPublicationsData,
    adAccountsData,
    adCampaignsData,
    adSetsData,
    adsData,
    adInsightsDailyData,
    adAlertsData
  ] = await Promise.all([
    client.from("profiles").select("*").eq("organization_id", organizationId),
    client.from("profile_areas").select("*").eq("organization_id", organizationId),
    client.from("profile_module_permissions").select("*").eq("organization_id", organizationId),
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
    client.from("idea_attachments").select("*").eq("organization_id", organizationId),
    client.from("customer_questions").select("*").eq("organization_id", organizationId),
    client.from("comments").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    client.from("auto_filters").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
    client.from("sales_clients").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
    client.from("sales_funnel_stages").select("*").eq("organization_id", organizationId).order("sort_order", { ascending: true }),
    client.from("call_schedules").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
    client.from("post_publications").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    client.from("ad_accounts").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
    client.from("ad_campaigns").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
    client.from("ad_sets").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
    client.from("ads").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
    client.from("ad_insights_daily").select("*").eq("organization_id", organizationId).order("date", { ascending: false }),
    client.from("ad_alerts").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })
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
    profileAreas: (profileAreas.data ?? []).map(mapProfileArea),
    profileModulePermissions: (profileModulePermissions.data ?? []).map(mapProfileModulePermission),
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
    adAccounts: (adAccountsData.data ?? []).map(mapAdAccount),
    adCampaigns: (adCampaignsData.data ?? []).map(mapAdCampaign),
    adSets: (adSetsData.data ?? []).map(mapAdSet),
    ads: (adsData.data ?? []).map(mapAd),
    adInsightsDaily: (adInsightsDailyData.data ?? []).map(mapAdInsightDaily),
    adAlerts: (adAlertsData.data ?? []).map(mapAdAlert),
    notifications: (notifications.data ?? []).map(mapNotification),
    calendarDates: (calendarDates.data ?? []).map(mapCalendarDate),
    customerQuestions: (customerQuestions.data ?? []).map(mapCustomerQuestion),
    ytComments: (ytCommentsData.data ?? []).map(mapYtComment),
    autoFilters: (autoFiltersData.data ?? []).map(mapAutoFilter),
    salesClients: (salesClientsData.data ?? []).map(mapSalesClient),
    salesFunnelStages: (salesFunnelStagesData.data ?? []).map(mapSalesFunnelStage),
    callSchedules: (callSchedulesData.data ?? []).map(mapCallSchedule),
    postPublications: (postPublicationsData.data ?? []).map(mapPostPublication)
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

export async function replaceProfileAreas(client: SupabaseClient, profileAreas: ProfileArea[], previous: ProfileArea[] = []) {
  await replaceSimple(client, "profile_areas", profileAreas, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    profile_id: item.profileId,
    area: item.area,
    active: item.active
  }));
}

export async function saveProfileArea(client: SupabaseClient, profileArea: ProfileArea) {
  await replaceProfileAreas(client, [profileArea], [profileArea]);
}

export async function deleteProfileArea(client: SupabaseClient, id: string) {
  await deleteById(client, "profile_areas", id);
}

export async function replaceProfileModulePermissions(client: SupabaseClient, permissions: ProfileModulePermission[], previous: ProfileModulePermission[] = []) {
  await replaceSimple(client, "profile_module_permissions", permissions, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    profile_id: item.profileId,
    area: item.area,
    module_id: item.moduleId,
    can_view: item.canView,
    can_create: item.canCreate,
    can_edit: item.canEdit,
    can_delete: item.canDelete,
    can_approve: item.canApprove,
    can_manage: item.canManage
  }));
}

export async function saveProfileModulePermission(client: SupabaseClient, permission: ProfileModulePermission) {
  await replaceProfileModulePermissions(client, [permission], [permission]);
}

export async function deleteProfileModulePermission(client: SupabaseClient, id: string) {
  await deleteById(client, "profile_module_permissions", id);
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
    channel_id: nullableText(item.channelId),
    product_line_id: nullableText(item.productLineId),
    vehicle_type_id: nullableText(item.vehicleTypeId),
    content_type_id: nullableText(item.contentTypeId),
    funnel_stage_id: nullableText(item.funnelStageId),
    template_id: nullableText(item.templateId),
    created_by: nullableText(item.createdBy),
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
    uploaded_by: nullableText(idea.createdBy),
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
    published_at: item.publishedAt ?? null,
    extra_channels: item.extraChannels ?? []
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
    reviewed_at: item.reviewedAt || null,
    is_cover: item.isCover ?? false,
    carousel_group_id: item.carouselGroupId || null,
    carousel_order: item.carouselOrder ?? null
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
    parent_task_id: nullableText(item.parentTaskId),
    task_column_id: item.columnId,
    funnel_stage_id: nullableText(item.funnelStageId),
    created_by: nullableText(item.createdBy),
    title: item.title,
    priority: nullableText(item.priority),
    progress: nullableText(item.progress),
    related_to: item.relatedTo ?? "",
    description: item.description ?? "",
    due_date: nullableText(item.dueDate),
    sort_order: item.order,
    reset_frequency: item.resetFrequency ?? "none",
    reset_time: item.resetTime ?? "23:59",
    reset_weekday: nullableNumber(item.resetWeekday),
    reset_month_day: nullableNumber(item.resetMonthDay),
    reset_month_last_day: item.resetMonthLastDay ?? false,
    fixed_goal_key: nullableText(item.fixedGoalKey),
    last_reset_at: nullableText(item.lastResetAt),
    next_reset_at: nullableText(item.nextResetAt),
    target_value: item.targetValue ?? null,
    current_value: item.currentValue ?? 0,
    unit: item.unit ? item.unit : null,
    is_private: item.isPrivate ?? false
  }));
  await replaceAssignees(client, "task_assignees", "task_id", organizationId, tasks.map((item) => ({ parentId: item.id, assignees: item.assignedTo ?? [] })));
  await replaceChildRows(client, "task_checklist_items", "task_id", organizationId, tasks.map((task) => task.id), tasks.flatMap((task) => (task.checklist ?? []).map((item, index) => ({ id: item.id, organization_id: organizationId, task_id: task.id, label: item.label, done: item.done, sort_order: index + 1 }))));
  await replaceChildRows(client, "task_comments", "task_id", organizationId, tasks.map((task) => task.id), tasks.flatMap((task) => (task.comments ?? []).map((item) => ({ id: item.id, organization_id: organizationId, task_id: task.id, author_id: nullableText(item.authorId), message: item.message, created_at: item.createdAt }))));
  await replaceChildRows(client, "task_attachments", "task_id", organizationId, tasks.map((task) => task.id), tasks.flatMap((task) => (task.attachments ?? []).map((item) => ({ id: item.id, organization_id: organizationId, task_id: task.id, uploaded_by: nullableText(task.createdBy), name: item.name, file_type: item.type, source: item.source, storage_path: item.url, public_url: item.url, preview_url: item.previewUrl, original_size: item.originalSize, compressed_size: item.compressedSize, mime_type: item.mimeType }))));
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
    product_line_id: item.productLineId || null,
    vehicle_type_id: item.vehicleTypeId || null,
    content_type_id: item.contentTypeId || null,
    funnel_stage_id: item.funnelStageId || null,
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
    privacy_status: item.privacyStatus ?? null,
    watch_time_minutes: item.watchTimeMinutes ?? null,
    average_view_duration_seconds: item.averageViewDurationSeconds ?? null,
    average_view_percentage: item.averageViewPercentage ?? null,
    subscribers_gained: item.subscribersGained ?? null,
    subscribers_lost: item.subscribersLost ?? null,
    impressions: item.impressions ?? null,
    impression_click_through_rate: item.impressionClickThroughRate ?? null,
    thumbnail_url: item.thumbnailUrl ?? null,
    source_url: item.sourceUrl ?? null,
    embed_url: item.embedUrl ?? null
  }));
}

export async function saveMetric(client: SupabaseClient, metric: PostMetric) {
  await replaceMetrics(client, [metric], [metric]);
}

export async function deleteMetric(client: SupabaseClient, id: string) {
  await deleteById(client, "post_metrics", id);
}

export async function replaceAdAccounts(client: SupabaseClient, items: AdAccount[], previous: AdAccount[] = []) {
  await replaceSimple(client, "ad_accounts", items, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    platform: item.platform,
    external_id: item.externalId ?? null,
    name: item.name,
    currency: item.currency || "BRL",
    status: item.status || "unknown",
    updated_at: item.updatedAt ?? new Date().toISOString()
  }));
}

export async function saveAdAccount(client: SupabaseClient, item: AdAccount) {
  await replaceAdAccounts(client, [item], [item]);
}

export async function deleteAdAccount(client: SupabaseClient, id: string) {
  await deleteById(client, "ad_accounts", id);
}

export async function replaceAdCampaigns(client: SupabaseClient, items: AdCampaign[], previous: AdCampaign[] = []) {
  await replaceSimple(client, "ad_campaigns", items, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    account_id: item.accountId,
    internal_campaign_id: item.internalCampaignId ?? null,
    external_id: item.externalId ?? null,
    name: item.name,
    objective: item.objective || "",
    status: item.status || "unknown",
    budget_amount: item.budgetAmount ?? null,
    budget_type: item.budgetType ?? null,
    starts_at: item.startsAt ?? null,
    ends_at: item.endsAt ?? null,
    updated_at: item.updatedAt ?? new Date().toISOString()
  }));
}

export async function saveAdCampaign(client: SupabaseClient, item: AdCampaign) {
  await replaceAdCampaigns(client, [item], [item]);
}

export async function deleteAdCampaign(client: SupabaseClient, id: string) {
  await deleteById(client, "ad_campaigns", id);
}

export async function replaceAdSets(client: SupabaseClient, items: AdSet[], previous: AdSet[] = []) {
  await replaceSimple(client, "ad_sets", items, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    account_id: item.accountId,
    campaign_id: item.campaignId,
    external_id: item.externalId ?? null,
    name: item.name,
    audience_name: item.audienceName ?? null,
    status: item.status || "unknown",
    budget_amount: item.budgetAmount ?? null,
    budget_type: item.budgetType ?? null,
    updated_at: item.updatedAt ?? new Date().toISOString()
  }));
}

export async function saveAdSet(client: SupabaseClient, item: AdSet) {
  await replaceAdSets(client, [item], [item]);
}

export async function deleteAdSet(client: SupabaseClient, id: string) {
  await deleteById(client, "ad_sets", id);
}

export async function replaceAds(client: SupabaseClient, items: Ad[], previous: Ad[] = []) {
  await replaceSimple(client, "ads", items, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    account_id: item.accountId,
    campaign_id: item.campaignId,
    ad_set_id: item.adSetId ?? null,
    external_id: item.externalId ?? null,
    name: item.name,
    creative_name: item.creativeName ?? null,
    status: item.status || "unknown",
    thumbnail_url: item.thumbnailUrl ?? null,
    source_url: item.sourceUrl ?? null,
    updated_at: item.updatedAt ?? new Date().toISOString()
  }));
}

export async function saveAd(client: SupabaseClient, item: Ad) {
  await replaceAds(client, [item], [item]);
}

export async function deleteAd(client: SupabaseClient, id: string) {
  await deleteById(client, "ads", id);
}

export async function replaceAdInsightsDaily(client: SupabaseClient, items: AdInsightDaily[], previous: AdInsightDaily[] = []) {
  await replaceSimple(client, "ad_insights_daily", items, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    platform: item.platform,
    account_id: item.accountId,
    campaign_id: item.campaignId ?? null,
    ad_set_id: item.adSetId ?? null,
    ad_id: item.adId ?? null,
    date: item.date,
    spend: item.spend,
    impressions: item.impressions,
    reach: item.reach,
    frequency: item.frequency,
    cpm: item.cpm,
    clicks: item.clicks,
    link_clicks: item.linkClicks,
    ctr: item.ctr,
    cpc: item.cpc,
    landing_page_views: item.landingPageViews,
    leads: item.leads,
    cost_per_lead: item.costPerLead,
    conversations: item.conversations,
    cost_per_conversation: item.costPerConversation,
    purchases: item.purchases,
    purchase_value: item.purchaseValue,
    cost_per_purchase: item.costPerPurchase,
    roas: item.roas,
    engagements: item.engagements,
    video_views: item.videoViews,
    cost_per_engagement: item.costPerEngagement,
    breakdown_placement: item.breakdownPlacement ?? null,
    breakdown_age: item.breakdownAge ?? null,
    breakdown_gender: item.breakdownGender ?? null,
    breakdown_region: item.breakdownRegion ?? null,
    breakdown_device: item.breakdownDevice ?? null,
    updated_at: item.updatedAt ?? new Date().toISOString()
  }));
}

export async function saveAdInsightDaily(client: SupabaseClient, item: AdInsightDaily) {
  await replaceAdInsightsDaily(client, [item], [item]);
}

export async function deleteAdInsightDaily(client: SupabaseClient, id: string) {
  await deleteById(client, "ad_insights_daily", id);
}

export async function replaceAdAlerts(client: SupabaseClient, items: AdAlert[], previous: AdAlert[] = []) {
  await replaceSimple(client, "ad_alerts", items, previous, (item, organizationId) => ({
    id: item.id,
    organization_id: organizationId,
    platform: item.platform,
    severity: item.severity,
    status: item.status,
    entity_type: item.entityType,
    entity_id: item.entityId,
    title: item.title,
    description: item.description,
    recommendation: item.recommendation,
    metric_key: item.metricKey,
    metric_value: item.metricValue ?? null,
    benchmark_value: item.benchmarkValue ?? null,
    date: item.date,
    reviewed_at: item.reviewedAt ?? null
  }));
}

export async function saveAdAlert(client: SupabaseClient, item: AdAlert) {
  await replaceAdAlerts(client, [item], [item]);
}

export async function deleteAdAlert(client: SupabaseClient, id: string) {
  await deleteById(client, "ad_alerts", id);
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

function nullableText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function nullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  return { id: row.id, organizationId: row.organization_id ?? "", name: row.name, email: row.email, phone: row.phone ?? "", bio: row.bio ?? "", role: row.role, avatarUrl: row.avatar_url ?? "", active: row.active ?? true, notificationSound: row.notification_sound ?? true };
}

function mapProfileArea(row: any): ProfileArea {
  return { id: row.id, profileId: row.profile_id, area: row.area, active: row.active ?? true };
}

function mapProfileModulePermission(row: any): ProfileModulePermission {
  return {
    id: row.id,
    profileId: row.profile_id,
    area: row.area,
    moduleId: row.module_id,
    canView: row.can_view ?? false,
    canCreate: row.can_create ?? false,
    canEdit: row.can_edit ?? false,
    canDelete: row.can_delete ?? false,
    canApprove: row.can_approve ?? false,
    canManage: row.can_manage ?? false
  };
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
  return { id: row.id, ideaId: row.idea_id ?? "", templateId: row.template_id ?? "", title: row.title, channelId: row.channel_id ?? "", campaignId: row.campaign_id ?? "", productLineId: row.product_line_id ?? "", vehicleTypeId: row.vehicle_type_id ?? "", contentTypeId: row.content_type_id ?? "", funnelStageId: row.funnel_stage_id ?? "", createdBy: row.created_by ?? "", assignedTo: assignees.map((item) => item.profile_id), status: row.status, format: row.format ?? "Post", extraChannels: Array.isArray(row.extra_channels) ? row.extra_channels : [], order: row.sort_order ?? 1, publishAt: String(row.publish_at ?? "").slice(0, 16), description: row.description ?? "", productionChecklist: row.production_checklist ?? [], publishedVideoId: row.published_video_id ?? undefined, publishedAt: row.published_at ?? undefined };
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
    isCover: row.is_cover ?? false,
    carouselGroupId: row.carousel_group_id ?? "",
    carouselOrder: row.carousel_order ?? undefined,
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
    priority: row.priority ?? "",
    progress: row.progress ?? "",
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
    nextResetAt: row.next_reset_at ?? undefined,
    targetValue: row.target_value != null ? Number(row.target_value) : undefined,
    currentValue: row.current_value != null ? Number(row.current_value) : 0,
    unit: row.unit ?? "",
    isPrivate: row.is_private ?? false
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
    privacyStatus: row.privacy_status ?? undefined,
    watchTimeMinutes: row.watch_time_minutes != null ? Number(row.watch_time_minutes) : undefined,
    averageViewDurationSeconds: row.average_view_duration_seconds != null ? Number(row.average_view_duration_seconds) : undefined,
    averageViewPercentage: row.average_view_percentage != null ? Number(row.average_view_percentage) : undefined,
    subscribersGained: row.subscribers_gained != null ? Number(row.subscribers_gained) : undefined,
    subscribersLost: row.subscribers_lost != null ? Number(row.subscribers_lost) : undefined,
    impressions: row.impressions != null ? Number(row.impressions) : undefined,
    impressionClickThroughRate: row.impression_click_through_rate != null ? Number(row.impression_click_through_rate) : undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    embedUrl: row.embed_url ?? undefined
  };
}

function mapAdAccount(row: any): AdAccount {
  return {
    id: row.id,
    platform: (row.platform ?? "meta") as AdAccount["platform"],
    externalId: row.external_id ?? undefined,
    name: row.name ?? "",
    currency: row.currency ?? "BRL",
    status: (row.status ?? "unknown") as AdAccount["status"],
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function mapAdCampaign(row: any): AdCampaign {
  return {
    id: row.id,
    accountId: row.account_id ?? "",
    internalCampaignId: row.internal_campaign_id ?? undefined,
    externalId: row.external_id ?? undefined,
    name: row.name ?? "",
    objective: row.objective ?? "",
    status: (row.status ?? "unknown") as AdCampaign["status"],
    budgetAmount: row.budget_amount != null ? Number(row.budget_amount) : undefined,
    budgetType: (row.budget_type ?? "unknown") as AdCampaign["budgetType"],
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function mapAdSet(row: any): AdSet {
  return {
    id: row.id,
    accountId: row.account_id ?? "",
    campaignId: row.campaign_id ?? "",
    externalId: row.external_id ?? undefined,
    name: row.name ?? "",
    audienceName: row.audience_name ?? undefined,
    status: (row.status ?? "unknown") as AdSet["status"],
    budgetAmount: row.budget_amount != null ? Number(row.budget_amount) : undefined,
    budgetType: (row.budget_type ?? "unknown") as AdSet["budgetType"],
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function mapAd(row: any): Ad {
  return {
    id: row.id,
    accountId: row.account_id ?? "",
    campaignId: row.campaign_id ?? "",
    adSetId: row.ad_set_id ?? undefined,
    externalId: row.external_id ?? undefined,
    name: row.name ?? "",
    creativeName: row.creative_name ?? undefined,
    status: (row.status ?? "unknown") as Ad["status"],
    thumbnailUrl: row.thumbnail_url ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function mapAdInsightDaily(row: any): AdInsightDaily {
  return {
    id: row.id,
    platform: (row.platform ?? "meta") as AdInsightDaily["platform"],
    accountId: row.account_id ?? "",
    campaignId: row.campaign_id ?? undefined,
    adSetId: row.ad_set_id ?? undefined,
    adId: row.ad_id ?? undefined,
    date: row.insight_date ?? row.date ?? "",
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    reach: Number(row.reach ?? 0),
    frequency: Number(row.frequency ?? 0),
    cpm: Number(row.cpm ?? 0),
    clicks: Number(row.clicks ?? 0),
    linkClicks: Number(row.link_clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    cpc: Number(row.cpc ?? 0),
    landingPageViews: Number(row.landing_page_views ?? 0),
    leads: Number(row.leads ?? 0),
    costPerLead: Number(row.cost_per_lead ?? 0),
    conversations: Number(row.conversations ?? 0),
    costPerConversation: Number(row.cost_per_conversation ?? 0),
    purchases: Number(row.purchases ?? 0),
    purchaseValue: Number(row.purchase_value ?? 0),
    costPerPurchase: Number(row.cost_per_purchase ?? 0),
    roas: Number(row.roas ?? 0),
    engagements: Number(row.engagements ?? 0),
    videoViews: Number(row.video_views ?? 0),
    costPerEngagement: Number(row.cost_per_engagement ?? 0),
    breakdownPlacement: row.breakdown_placement ?? undefined,
    breakdownAge: row.breakdown_age ?? undefined,
    breakdownGender: row.breakdown_gender ?? undefined,
    breakdownRegion: row.breakdown_region ?? undefined,
    breakdownDevice: row.breakdown_device ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function mapAdAlert(row: any): AdAlert {
  return {
    id: row.id,
    platform: (row.platform ?? "meta") as AdAlert["platform"],
    severity: (row.severity ?? "atencao") as AdAlert["severity"],
    status: (row.status ?? "open") as AdAlert["status"],
    entityType: (row.entity_type ?? "campaign") as AdAlert["entityType"],
    entityId: row.entity_id ?? "",
    title: row.title ?? "",
    description: row.description ?? "",
    recommendation: row.recommendation ?? "",
    metricKey: row.metric_key ?? "",
    metricValue: row.metric_value != null ? Number(row.metric_value) : undefined,
    benchmarkValue: row.benchmark_value != null ? Number(row.benchmark_value) : undefined,
    date: row.alert_date ?? row.date ?? row.created_at?.slice(0, 10) ?? "",
    createdAt: row.created_at ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined
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

function mapCustomerQuestion(row: any): CustomerQuestion {
  const sourceCommentId = row.source_comment_id ?? row.from_comment_id ?? undefined;
  return {
    id: row.id,
    organizationId: row.organization_id,
    source: row.source ?? "manual",
    externalId: row.external_id ?? undefined,
    videoId: row.video_id ?? undefined,
    videoTitle: row.video_title ?? undefined,
    questionText: row.question_text ?? "",
    answerText: row.answer_text ?? "",
    authorName: row.author_name ?? "",
    likes: row.likes ?? 0,
    status: row.status ?? "pendente",
    category: row.category ?? "",
    reviewerId: row.reviewer_id ?? undefined,
    learning: row.learning ?? "",
    fromCommentId: row.from_comment_id ?? undefined,
    sourceCommentId,
    needsReview: row.needs_review ?? false,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    aiConfidence: row.ai_confidence ?? undefined,
    aiReason: row.ai_reason ?? undefined,
    publishedAt: row.published_at ?? undefined,
    answeredAt: row.answered_at ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

export async function replaceCustomerQuestions(
  client: SupabaseClient,
  questions: CustomerQuestion[],
  previous: CustomerQuestion[] = []
) {
  const organizationId = await currentOrganizationId(client);
  await deleteRemovedRows(client, "customer_questions", organizationId, previous, questions);
  if (!questions.length) return;
  const { error } = await client.from("customer_questions").upsert(
    questions.map((q) => ({
      id: q.id,
      organization_id: organizationId,
      source: q.source,
      external_id: q.externalId ?? null,
      video_id: q.videoId ?? null,
      video_title: q.videoTitle ?? null,
      question_text: q.questionText,
      answer_text: q.answerText || null,
      author_name: q.authorName || null,
      likes: q.likes,
      status: q.status,
      category: q.category || null,
      reviewer_id: q.reviewerId ?? null,
      learning: q.learning || null,
      from_comment_id: q.fromCommentId ?? q.sourceCommentId ?? null,
      source_comment_id: q.sourceCommentId ?? q.fromCommentId ?? null,
      needs_review: q.needsReview,
      reviewed_at: q.reviewedAt ?? null,
      reviewed_by: q.reviewedBy ?? null,
      ai_confidence: q.aiConfidence ?? null,
      ai_reason: q.aiReason ?? null,
      published_at: q.publishedAt ?? null,
      answered_at: q.answeredAt ?? null
    }))
  );
  if (error) throw new Error(`customer_questions upsert: ${error.message}`);
}

// Upsert de uma única pergunta (salvar resposta, revisão, etc.)
export async function saveCustomerQuestion(client: SupabaseClient, q: CustomerQuestion) {
  const organizationId = await currentOrganizationId(client);
  const { error } = await client.from("customer_questions").upsert({
    id: q.id,
    organization_id: organizationId,
    source: q.source,
    external_id: q.externalId ?? null,
    video_id: q.videoId ?? null,
    video_title: q.videoTitle ?? null,
    question_text: q.questionText,
    answer_text: q.answerText || null,
    author_name: q.authorName || null,
    likes: q.likes ?? 0,
    status: q.status,
    category: q.category || null,
    reviewer_id: q.reviewerId ?? null,
    learning: q.learning || null,
    from_comment_id: q.fromCommentId ?? q.sourceCommentId ?? null,
    source_comment_id: q.sourceCommentId ?? q.fromCommentId ?? null,
    needs_review: q.needsReview,
    reviewed_at: q.reviewedAt ?? null,
    reviewed_by: q.reviewedBy ?? null,
    ai_confidence: q.aiConfidence ?? null,
    ai_reason: q.aiReason ?? null,
    published_at: q.publishedAt ?? null,
    answered_at: q.answeredAt ?? null,
  });
  if (error) throw new Error(`customer_questions upsert: ${error.message}`);
}

export async function deleteCustomerQuestion(client: SupabaseClient, id: string) {
  await deleteById(client, "customer_questions", id);
}

// Insere apenas perguntas NOVAS (importação YouTube) — não faz delete/replace
export async function insertCustomerQuestions(
  client: SupabaseClient,
  questions: CustomerQuestion[]
) {
  if (!questions.length) return;
  const organizationId = await currentOrganizationId(client);
  const rows = questions.map((q) => ({
    id: q.id,
    organization_id: organizationId,
    source: q.source,
    external_id: q.externalId ?? null,
    video_id: q.videoId ?? null,
    video_title: q.videoTitle ?? null,
    question_text: q.questionText,
    answer_text: q.answerText || null,
    author_name: q.authorName || null,
    likes: q.likes ?? 0,
    status: q.status,
    category: q.category || null,
    reviewer_id: q.reviewerId ?? null,
    learning: q.learning || null,
    from_comment_id: q.fromCommentId ?? q.sourceCommentId ?? null,
    source_comment_id: q.sourceCommentId ?? q.fromCommentId ?? null,
    needs_review: q.needsReview,
    reviewed_at: q.reviewedAt ?? null,
    reviewed_by: q.reviewedBy ?? null,
    ai_confidence: q.aiConfidence ?? null,
    ai_reason: q.aiReason ?? null,
    published_at: q.publishedAt ?? null,
    answered_at: q.answeredAt ?? null
  }));
  // ON CONFLICT (organization_id, external_id) DO NOTHING — idempotente para reimportações
  const { error } = await client
    .from("customer_questions")
    .upsert(rows, { onConflict: "organization_id,external_id", ignoreDuplicates: true });
  if (error) throw new Error(`customer_questions insert: ${error.message}`);

  // Segundo passo: preenche answer_text em rows existentes que ainda estão com NULL
  // (comentários importados antes do channelReply ser extraído)
  // Só atualiza se: tem external_id + tem answer_text + o valor atual no banco é NULL
  // Preserva respostas já editadas manualmente pelo usuário.
  const rowsWithReply = rows.filter((r) => r.external_id && r.answer_text);
  if (rowsWithReply.length > 0) {
    await Promise.all(
      rowsWithReply.map((r) =>
        client
          .from("customer_questions")
          .update({ answer_text: r.answer_text })
          .eq("organization_id", r.organization_id)
          .eq("external_id", r.external_id!)
          .is("answer_text", null)
      )
    );
  }
}

// ─── Comments (YouTube CRM) ──────────────────────────────────────────────────

function mapYtComment(row: any): Comment {
  return {
    id: row.id,
    source: row.source ?? "youtube",
    externalId: row.external_id ?? undefined,
    importSignature: row.import_signature ?? undefined,
    videoId: row.video_id ?? undefined,
    videoTitle: row.video_title ?? undefined,
    mediaThumbnailUrl: row.media_thumbnail_url ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    mediaPermalink: row.media_permalink ?? undefined,
    authorName: row.author_name ?? "",
    text: row.text ?? "",
    likes: row.likes ?? 0,
    likedByOrg: row.liked_by_org ?? false,
    externalReplies: Array.isArray(row.external_replies) ? row.external_replies : [],
    response: row.response ?? undefined,
    responseExternalId: row.response_external_id ?? undefined,
    responseHistory: Array.isArray(row.response_history) ? row.response_history : [],
    status: row.status ?? "novo",
    addedToBank: row.added_to_bank ?? false,
    bankQuestionId: row.bank_question_id ?? undefined,
    publishedAt: row.published_at ?? undefined,
    retentionUntil: row.retention_until ?? undefined,
    processedAt: row.processed_at ?? undefined,
    isRelevant: row.is_relevant ?? undefined,
    classificationStatus: row.classification_status ?? undefined,
    classificationReason: row.classification_reason ?? undefined,
    suggestedReply: row.suggested_reply ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

function normalizeCommentText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function commentImportSignature(comment: Pick<Comment, "source" | "videoId" | "authorName" | "text" | "publishedAt">) {
  return [
    comment.source,
    comment.videoId ?? "",
    normalizeCommentText(comment.authorName ?? ""),
    normalizeCommentText(comment.text ?? ""),
    comment.publishedAt ?? ""
  ].join("|");
}

function addDaysIso(dateLike: string | undefined, days: number) {
  const base = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(base.getTime())) base.setTime(Date.now());
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

function preserveCommentStatus(existing: any | undefined, incoming: Comment) {
  if (!existing?.status) return incoming.status;
  if (existing.status === "respondido" && incoming.status !== "respondido") return existing.status;
  if (existing.status === "ignorado" && incoming.status === "novo") return existing.status;
  return incoming.status;
}

function preserveCommentClassification(existing: any | undefined, incoming: Comment) {
  const current = existing?.classification_status;
  if (current && current !== "pendente") return current;
  return incoming.classificationStatus ?? current ?? null;
}

function mergeResponseHistory(existing: any | undefined, incoming: Comment) {
  if (Array.isArray(incoming.responseHistory) && incoming.responseHistory.length) return incoming.responseHistory;
  if (Array.isArray(existing?.response_history)) return existing.response_history;
  return [];
}

function mapCommentForUpsert(comment: Comment, organizationId: string, existing?: any) {
  const createdAt = existing?.created_at ?? comment.createdAt ?? new Date().toISOString();
  const addedToBank = Boolean(existing?.added_to_bank || comment.addedToBank);
  const bankQuestionId = existing?.bank_question_id ?? comment.bankQuestionId ?? null;
  const classificationStatus = preserveCommentClassification(existing, comment);
  const isRelevant = existing?.is_relevant ?? comment.isRelevant ?? addedToBank;
  return {
    id: existing?.id ?? comment.id,
    organization_id: organizationId,
    source: comment.source,
    external_id: comment.externalId ?? null,
    import_signature: comment.importSignature ?? commentImportSignature(comment),
    video_id: comment.videoId ?? null,
    video_title: comment.videoTitle ?? existing?.video_title ?? null,
    media_thumbnail_url: comment.mediaThumbnailUrl ?? existing?.media_thumbnail_url ?? null,
    media_url: comment.mediaUrl ?? existing?.media_url ?? null,
    media_permalink: comment.mediaPermalink ?? existing?.media_permalink ?? null,
    author_name: comment.authorName,
    text: comment.text,
    likes: comment.likes,
    liked_by_org: comment.likedByOrg ?? existing?.liked_by_org ?? false,
    external_replies: comment.externalReplies ?? existing?.external_replies ?? [],
    response: comment.response ?? existing?.response ?? null,
    response_external_id: comment.responseExternalId ?? existing?.response_external_id ?? null,
    response_history: mergeResponseHistory(existing, comment),
    status: preserveCommentStatus(existing, comment),
    added_to_bank: addedToBank,
    bank_question_id: bankQuestionId,
    published_at: comment.publishedAt ?? null,
    retention_until: existing?.retention_until ?? comment.retentionUntil ?? addDaysIso(createdAt, 90),
    processed_at: existing?.processed_at ?? comment.processedAt ?? null,
    is_relevant: isRelevant,
    classification_status: classificationStatus,
    classification_reason: existing?.classification_reason ?? comment.classificationReason ?? null,
    suggested_reply: existing?.suggested_reply ?? comment.suggestedReply ?? null,
    created_at: createdAt
  };
}

export async function saveComment(client: SupabaseClient, comment: Comment) {
  const organizationId = await currentOrganizationId(client);
  const { data: existing } = await client
    .from("comments")
    .select("*")
    .eq("id", comment.id)
    .maybeSingle();
  const { error } = await client.from("comments").upsert(mapCommentForUpsert(comment, organizationId, existing));
  if (error) throw new Error(`comments upsert: ${error.message}`);
}

export async function deleteComment(client: SupabaseClient, id: string) {
  const { error } = await client.from("comments").delete().eq("id", id);
  if (error) throw new Error(`comments delete: ${error.message}`);
}

export async function insertComments(client: SupabaseClient, items: Comment[]) {
  if (!items.length) return;
  const organizationId = await currentOrganizationId(client);
  const normalized = items.map((comment) => ({
    ...comment,
    importSignature: comment.importSignature ?? commentImportSignature(comment)
  }));

  const externalIds = Array.from(new Set(normalized.map((c) => c.externalId).filter((id): id is string => Boolean(id))));
  const signatures = Array.from(new Set(normalized.map((c) => c.importSignature).filter((id): id is string => Boolean(id))));
  const existingRows: any[] = [];

  if (externalIds.length) {
    const { data, error } = await client
      .from("comments")
      .select("*")
      .eq("organization_id", organizationId)
      .in("external_id", externalIds);
    if (error) throw new Error(`comments existing by external_id: ${error.message}`);
    existingRows.push(...(data ?? []));
  }

  if (signatures.length) {
    const { data, error } = await client
      .from("comments")
      .select("*")
      .eq("organization_id", organizationId)
      .in("import_signature", signatures);
    if (error) throw new Error(`comments existing by signature: ${error.message}`);
    existingRows.push(...(data ?? []));
  }

  const existingByExternal = new Map(existingRows.filter((row) => row.external_id).map((row) => [`${row.source}:${row.external_id}`, row]));
  const existingBySignature = new Map(existingRows.filter((row) => row.import_signature).map((row) => [`${row.source}:${row.import_signature}`, row]));
  const rows = normalized.map((comment) => {
    const existing =
      (comment.externalId ? existingByExternal.get(`${comment.source}:${comment.externalId}`) : undefined) ??
      (comment.importSignature ? existingBySignature.get(`${comment.source}:${comment.importSignature}`) : undefined);
    return mapCommentForUpsert(comment, organizationId, existing);
  });

  const { error } = await client.from("comments").upsert(rows);
  if (error) throw new Error(`comments insert: ${error.message}`);
}

// ─── Auto Filters ────────────────────────────────────────────────────────────

function mapAutoFilter(row: any): AutoFilter {
  return {
    id: row.id,
    keyword: row.keyword ?? "",
    matchType: row.match_type ?? "contains",
    active: row.active ?? true,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

export async function saveAutoFilter(client: SupabaseClient, filter: AutoFilter) {
  const organizationId = await currentOrganizationId(client);
  const { error } = await client.from("auto_filters").upsert({
    id: filter.id,
    organization_id: organizationId,
    keyword: filter.keyword,
    match_type: filter.matchType,
    active: filter.active
  });
  if (error) throw new Error(`auto_filters upsert: ${error.message}`);
}

export async function deleteAutoFilter(client: SupabaseClient, id: string) {
  const { error } = await client.from("auto_filters").delete().eq("id", id);
  if (error) throw new Error(`auto_filters delete: ${error.message}`);
}

// ─── Vendas — Clientes ────────────────────────────────────────────────────────

function mapSalesClient(row: any): SalesClient {
  return {
    id: row.id,
    externalCode: row.external_code ?? "",
    name: row.name ?? "",
    clientType: row.client_type ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    company: row.company ?? "",
    segment: row.segment ?? "",
    stateUf: row.state_uf ?? "",
    city: row.city ?? "",
    lastPurchaseAt: row.last_purchase_at ?? "",
    lastPurchaseValue: row.last_purchase_value != null ? Number(row.last_purchase_value) : undefined,
    status: row.status ?? "lead",
    source: row.source ?? "manual",
    cpf: row.cpf ?? "",
    cnpj: row.cnpj ?? "",
    assignedTo: row.assigned_to ?? "",
    notes: row.notes ?? "",
    sourceCustom: row.source_custom ?? "",
    proposals: Array.isArray(row.proposals) ? (row.proposals as SalesProposal[]) : [],
    salesFunnelStage: row.sales_funnel_stage ?? "lead",
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

export async function saveSalesClient(client: SupabaseClient, item: SalesClient) {
  const organizationId = await currentOrganizationId(client);
  const { error } = await client.from("sales_clients").upsert({
    id: item.id,
    organization_id: organizationId,
    external_code: item.externalCode,
    name: item.name,
    client_type: item.clientType,
    email: item.email,
    phone: item.phone,
    company: item.company,
    segment: item.segment,
    state_uf: item.stateUf,
    city: item.city,
    last_purchase_at: item.lastPurchaseAt || null,
    last_purchase_value: item.lastPurchaseValue ?? null,
    status: item.status,
    source: item.source,
    source_custom: item.sourceCustom || null,
    cpf: item.cpf || null,
    cnpj: item.cnpj || null,
    assigned_to: item.assignedTo || null,
    notes: item.notes,
    proposals: item.proposals,
    sales_funnel_stage: item.salesFunnelStage
  });
  if (error) throw new Error(`sales_clients upsert: ${error.message}`);
}

export async function deleteSalesClient(client: SupabaseClient, id: string) {
  await deleteById(client, "sales_clients", id);
}

// ─── Vendas — Funil Comercial (etapas) ───────────────────────────────────────

function mapSalesFunnelStage(row: any): SalesFunnelStage {
  return { id: row.id, name: row.name, color: row.color, emoji: row.emoji, order: row.sort_order, halfWidth: row.half_width ?? false };
}

export async function saveSalesFunnelStage(client: SupabaseClient, item: SalesFunnelStage) {
  const organizationId = await currentOrganizationId(client);
  const { error } = await client.from("sales_funnel_stages").upsert({
    id: item.id,
    organization_id: organizationId,
    name: item.name,
    color: item.color,
    emoji: item.emoji,
    sort_order: item.order,
    half_width: item.halfWidth,
  });
  if (error) throw new Error(`sales_funnel_stages upsert: ${error.message}`);
}

export async function deleteSalesFunnelStage(client: SupabaseClient, id: string) {
  await deleteById(client, "sales_funnel_stages", id);
}

// ─── Vendas — Ligações ────────────────────────────────────────────────────────

function mapCallSchedule(row: any): CallSchedule {
  return {
    id: row.id,
    clientId: row.client_id ?? "",
    clientName: row.client_name ?? "",
    phone: row.phone ?? "",
    frequency: (row.frequency ?? "weekly") as CallFrequency,
    nextCallAt: row.next_call_at ?? new Date().toISOString().slice(0, 10),
    lastCallAt: row.last_call_at ?? undefined,
    callHistory: Array.isArray(row.call_history) ? (row.call_history as CallLog[]) : [],
    assignedTo: row.assigned_to ?? "",
    createdBy: row.created_by ?? "",
    active: row.active ?? true,
    archived: row.archived ?? false,
    manualDate: row.manual_date ?? false,
    notes: row.notes ?? ""
  };
}

export async function saveCallSchedule(client: SupabaseClient, item: CallSchedule) {
  const organizationId = await currentOrganizationId(client);
  const { error } = await client.from("call_schedules").upsert({
    id: item.id,
    organization_id: organizationId,
    client_id: item.clientId,
    client_name: item.clientName,
    phone: item.phone,
    frequency: item.frequency,
    next_call_at: item.nextCallAt,
    last_call_at: item.lastCallAt ?? null,
    call_history: item.callHistory,
    assigned_to: item.assignedTo || null,
    created_by: item.createdBy,
    active: item.active,
    archived: item.archived,
    manual_date: item.manualDate ?? false,
    notes: item.notes
  });
  if (error) throw new Error(`call_schedules upsert: ${error.message}`);
}

export async function deleteCallSchedule(client: SupabaseClient, id: string) {
  await deleteById(client, "call_schedules", id);
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export async function saveFeedback(
  client: SupabaseClient,
  organizationId: string,
  item: Pick<import("./types").AppFeedback, "createdBy" | "kind" | "description" | "attachments">
): Promise<string> {
  const id = crypto.randomUUID();
  await client.from("feedback").insert({
    id,
    organization_id: organizationId,
    created_by: item.createdBy,
    kind: item.kind,
    description: item.description,
    attachments: item.attachments,
  });
  return id;
}

export async function loadFeedbacks(client: SupabaseClient): Promise<import("./types").AppFeedback[]> {
  const organizationId = await currentOrganizationId(client);
  const { data } = await client
    .from("feedback")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id as string,
    organizationId: row.organization_id as string,
    createdBy: row.created_by as string,
    kind: row.kind as import("./types").FeedbackKind,
    description: row.description as string,
    attachments: (row.attachments ?? []) as import("./types").FileAttachment[],
    status: row.status as import("./types").FeedbackStatus,
    createdAt: row.created_at as string,
    reply: row.reply as string | undefined,
    repliedBy: row.replied_by as string | undefined,
    repliedAt: row.replied_at as string | undefined,
  }));
}

export async function replyFeedback(
  client: SupabaseClient,
  feedbackId: string,
  reply: string,
  repliedBy: string
): Promise<void> {
  await client.from("feedback").update({
    reply,
    replied_by: repliedBy,
    replied_at: new Date().toISOString(),
    status: "resolvido",
  }).eq("id", feedbackId);
}

export async function deleteFeedback(client: SupabaseClient, id: string): Promise<void> {
  await client.from("feedback").delete().eq("id", id);
}

function mapPostPublication(row: any): PostPublication {
  return {
    id: String(row.id ?? ""),
    postId: String(row.post_id ?? ""),
    platform: row.platform ?? "outros",
    status: row.status ?? "pending",
    title: String(row.title ?? ""),
    caption: String(row.caption ?? ""),
    format: String(row.format ?? ""),
    assetUrl: String(row.asset_url ?? ""),
    thumbnailUrl: row.thumbnail_url ?? undefined,
    externalId: row.external_id ?? undefined,
    permalink: row.permalink ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    error: row.error ?? undefined,
    attempts: Number(row.attempts ?? 0),
    createdBy: row.created_by ?? undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
