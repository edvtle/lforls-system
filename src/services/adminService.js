import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { itemsUpdatedEventName } from "../utils/itemStore";
import { createNotification } from "../utils/notificationStore";

const resetApiBaseUrl =
  import.meta.env.VITE_RESET_API_BASE_URL || "http://localhost:4001";

const ITEM_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1200&q=80";

const assertSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Admin data is not configured.");
  }
};

const isMissingRelationError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("relation") ||
    message.includes("does not exist")
  );
};

const formatLabel = (value = "") =>
  String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const parseTimestamp = (value) => {
  if (!value) return Number.NaN;
  const milliseconds = Date.parse(String(value));
  return Number.isFinite(milliseconds) ? milliseconds : Number.NaN;
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10) || "N/A";
  }
  return date.toISOString().slice(0, 10);
};

const parseConversationId = (target = "") => {
  const match = String(target || "").match(/^conversation:(.+)$/i);
  return match?.[1] || "";
};

const mapItem = (item) => {
  const images = Array.isArray(item.item_images) ? item.item_images : [];
  const primary = images.find((entry) => entry.is_primary) || images[0];
  const gallery = images
    .slice()
    .sort((left, right) => {
      if (left?.is_primary && !right?.is_primary) return -1;
      if (!left?.is_primary && right?.is_primary) return 1;
      return 0;
    })
    .map((entry) => String(entry?.public_url || "").trim())
    .filter(Boolean);
  const uniqueGallery = [...new Set(gallery)];
  const resolvedGallery = uniqueGallery.length
    ? uniqueGallery
    : [primary?.public_url || ITEM_FALLBACK_IMAGE];

  return {
    id: item.id,
    image: primary?.public_url || ITEM_FALLBACK_IMAGE,
    gallery: resolvedGallery,
    name: item.item_name || "Unnamed item",
    category: item.category || "Others",
    location: item.location_text || "Unknown",
    description: item.description || "No description provided.",
    color: item.color || "N/A",
    brand: item.brand || "N/A",
    identifiers: item.identifiers || "N/A",
    contactMethod: item.contact_method || "N/A",
    contactValue: item.contact_value || "N/A",
    typeLabel: item.type === "found" ? "Found" : "Lost",
    lifecycleStatus: formatLabel(item.status || "open"),
    date: formatDate(item.date_lost_or_found || item.created_at),
    rawStatus: item.status || "open",
    createdAt: item.created_at || "",
  };
};

const mapUser = (profile) => ({
  id: profile.id,
  name: profile.full_name || "Unnamed user",
  email: profile.email || "No email",
  department: profile.college_dept || "N/A",
  yearSection: profile.year_section || "N/A",
  reportsCount: Number(profile.reports_count ?? profile.items?.[0]?.count ?? 0),
  status: formatLabel(profile.status || "active"),
  rawStatus: profile.status || "active",
  suspendedUntil: profile.suspended_until || "",
});

const reconcileExpiredSuspensions = async (users = []) => {
  const now = Date.now();
  const expiredIds = users
    .filter((user) => {
      const isSuspended =
        String(user.rawStatus || "").toLowerCase() === "suspended";
      if (!isSuspended) return false;
      const suspendedUntilMs = parseTimestamp(user.suspendedUntil);
      return Number.isFinite(suspendedUntilMs) && suspendedUntilMs <= now;
    })
    .map((user) => user.id);

  if (!expiredIds.length) {
    return users;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: "active", suspended_until: null })
    .in("id", expiredIds)
    .eq("status", "suspended")
    .lte("suspended_until", new Date().toISOString());

  if (error) {
    return users;
  }

  return users.map((user) =>
    expiredIds.includes(user.id)
      ? {
          ...user,
          rawStatus: "active",
          status: "Active",
          suspendedUntil: "",
        }
      : user,
  );
};

const mapClaim = (claim) => ({
  id: claim.id,
  itemId: claim.item_id || claim.found_item_id || claim.listing_id || "",
  item: claim.items?.item_name || claim.item_name || "Unknown item",
  fullName: claim.full_name || claim.claimant_name || "Unknown claimant",
  contact: claim.contact || claim.contact_value || "N/A",
  collegeDept: claim.college_dept || "N/A",
  programYear: claim.program_year || "N/A",
  routeTo: claim.route_to || "admin-panel",
  status: formatLabel(claim.status || "pending"),
  rawStatus: claim.status || "pending",
});

const mapFlag = (flag, reporterMap = new Map()) => {
  const images = Array.isArray(flag.items?.item_images)
    ? flag.items.item_images
    : [];
  const primary = images.find((entry) => entry.is_primary) || images[0];
  const gallery = images
    .slice()
    .sort((left, right) => {
      if (left?.is_primary && !right?.is_primary) return -1;
      if (!left?.is_primary && right?.is_primary) return 1;
      return 0;
    })
    .map((entry) => String(entry?.public_url || "").trim())
    .filter(Boolean);
  const uniqueGallery = [...new Set(gallery)];
  const resolvedGallery = uniqueGallery.length
    ? uniqueGallery
    : [primary?.public_url || ITEM_FALLBACK_IMAGE];
  const conversationId = parseConversationId(flag.target);
  const isChatReport = Boolean(conversationId);
  const reporter = reporterMap.get(flag.user_id) || null;

  const relatedHref = isChatReport
    ? `/messages?conv=${encodeURIComponent(conversationId)}`
    : flag.item_id
      ? `/details/${flag.item_id}`
      : "";
  const itemHref = flag.item_id ? `/details/${flag.item_id}` : "";
  const conversationHref = isChatReport
    ? `/messages?conv=${encodeURIComponent(conversationId)}`
    : "";

  return {
    id: flag.id,
    userId: flag.user_id,
    reportedStudent:
      reporter?.full_name ||
      reporter?.email ||
      flag.user_id ||
      "Unknown student",
    reportedStudentEmail: reporter?.email || "",
    itemId: flag.item_id,
    reason: flag.reason || flag.title || "Reported issue",
    target: flag.target || flag.body || "No target details",
    body: flag.body || "",
    reportType: isChatReport ? "chat" : "content",
    conversationId,
    relatedHref,
    itemHref,
    conversationHref,
    relatedLabel: isChatReport
      ? `Conversation ${conversationId}`
      : flag.item_id
        ? `Item ${flag.item_id}`
        : "No linked record",
    severity: formatLabel(flag.severity || flag.priority || "medium"),
    rawSeverity: flag.severity || "medium",
    status: formatLabel(flag.status || "open"),
    rawStatus: flag.status || "open",
    createdAt: flag.created_at || "",
    itemName: flag.item_name || flag.items?.item_name || "Unknown item",
    itemDetails: flag.items
      ? {
          id: flag.items.id,
          image: primary?.public_url || ITEM_FALLBACK_IMAGE,
          gallery: resolvedGallery,
          name: flag.items.item_name || "Unnamed item",
          category: flag.items.category || "Others",
          location: flag.items.location_text || "Unknown",
          description: flag.items.description || "No description provided.",
          color: flag.items.color || "N/A",
          brand: flag.items.brand || "N/A",
          identifiers: flag.items.identifiers || "N/A",
          contactMethod: flag.items.contact_method || "N/A",
          contactValue: flag.items.contact_value || "N/A",
          typeLabel: flag.items.type === "found" ? "Found" : "Lost",
          lifecycleStatus: formatLabel(flag.items.status || "open"),
          date: formatDate(
            flag.items.date_lost_or_found || flag.items.created_at,
          ),
        }
      : null,
  };
};

const groupReportsByDay = (items) => {
  const today = new Date();
  const buckets = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    buckets.push({
      day: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      key,
      reports: 0,
    });
  }

  items.forEach((item) => {
    const key = String(item.createdAt || "").slice(0, 10);
    const bucket = buckets.find((entry) => entry.key === key);
    if (bucket) {
      bucket.reports += 1;
    }
  });

  return buckets.map(({ day, reports }) => ({ day, reports }));
};

const buildActivityLogs = ({ items, users, claims, flags }) => {
  const logs = [
    ...items.slice(0, 2).map((item) => ({
      id: `item-${item.id}`,
      icon: "item",
      text: `Item report added: ${item.name}`,
    })),
    ...users.slice(0, 1).map((user) => ({
      id: `user-${user.id}`,
      icon: "user",
      text: `User profile in database: ${user.name}`,
    })),
    ...claims.slice(0, 1).map((claim) => ({
      id: `claim-${claim.id}`,
      icon: "claim",
      text: `Claim record: ${claim.id}`,
    })),
    ...flags.slice(0, 1).map((flag) => ({
      id: `flag-${flag.id}`,
      icon: "flag",
      text: `Report flag: ${flag.reason}`,
    })),
  ];

  return logs.slice(0, 4);
};

const notifyItemsUpdated = () => {
  window.dispatchEvent(new Event(itemsUpdatedEventName));
};

export const listAdminItems = async () => {
  assertSupabase();

  const { data, error } = await supabase
    .from("items")
    .select(
      "id, type, status, item_name, category, location_text, description, color, brand, identifiers, contact_method, contact_value, date_lost_or_found, created_at, item_images(public_url, is_primary)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return (data || []).map(mapItem);
};

export const listAdminUsers = async () => {
  assertSupabase();

  // Preferred path: database RPC that includes all auth users, even if profile row is missing.
  const { data: rpcUsers, error: rpcError } =
    await supabase.rpc("admin_list_users");
  if (!rpcError && Array.isArray(rpcUsers)) {
    const mapped = rpcUsers.map(mapUser);
    return reconcileExpiredSuspensions(mapped);
  }

  if (resetApiBaseUrl) {
    let response;
    try {
      response = await fetch(`${resetApiBaseUrl}/api/admin/list-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
    } catch {
      response = null;
    }

    if (response?.ok) {
      const body = await response.json().catch(() => ({}));
      const mapped = (body?.users || []).map(mapUser);
      return reconcileExpiredSuspensions(mapped);
    }
  }

  // Fallback when admin API is unavailable.
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, college_dept, year_section, status, suspended_until, items(count)",
    )
    .order("full_name", { ascending: true })
    .limit(200);

  if (error) throw error;

  const mapped = (data || []).map(mapUser);
  return reconcileExpiredSuspensions(mapped);
};

export const listAdminClaims = async () => {
  assertSupabase();

  const primary = await supabase
    .from("claims")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  let data = primary.data;
  let error = primary.error;

  if (error) {
    const fallback = await supabase.from("claims").select("*").limit(200);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return (data || []).map(mapClaim);
};

export const deleteAdminClaim = async (claimId) => {
  assertSupabase();

  const { error: rpcError } = await supabase.rpc("admin_delete_claim", {
    target_claim_id: claimId,
  });
  if (rpcError) {
    const { error } = await supabase.from("claims").delete().eq("id", claimId);
    if (error) throw error;
  }

  return { success: true };
};

export const listAdminFlags = async () => {
  assertSupabase();

  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, user_id, item_id, item_name, reason, target, body, severity, status, created_at, items(id, type, status, item_name, category, location_text, description, color, brand, identifiers, contact_method, contact_value, date_lost_or_found, created_at, item_images(public_url, is_primary))",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  const userIds = [
    ...new Set((data || []).map((entry) => entry.user_id).filter(Boolean)),
  ];
  const reporterMap = new Map();

  if (userIds.length) {
    const { data: reporters, error: reporterError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (!reporterError) {
      (reporters || []).forEach((profile) => {
        reporterMap.set(profile.id, profile);
      });
    }
  }

  return (data || []).map((flag) => mapFlag(flag, reporterMap));
};

export const suspendChatConversationFromReport = async ({
  reportId,
  conversationId,
  reason,
}) => {
  assertSupabase();

  if (!reportId || !conversationId) {
    throw new Error("A report and conversation are required to suspend chat.");
  }

  const normalizedReason = String(reason || "").trim();
  const suspensionMessage =
    normalizedReason || "This chat was reported for safety concerns.";

  const { error: conversationError } = await supabase
    .from("message_conversations")
    .update({
      blocked: true,
      reported: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (conversationError) {
    throw conversationError;
  }

  const { error: reportError } = await supabase
    .from("reports")
    .update({
      status: "chat_suspended",
      body: suspensionMessage,
    })
    .eq("id", reportId);

  if (reportError) {
    throw reportError;
  }

  window.dispatchEvent(new Event("lforls:messages-updated"));
};

export const toggleChatConversationSuspension = async ({
  reportId,
  conversationId,
  reason,
  shouldSuspend = true,
}) => {
  assertSupabase();

  if (!reportId || !conversationId) {
    throw new Error("A report and conversation are required.");
  }

  if (shouldSuspend) {
    return suspendChatConversationFromReport({
      reportId,
      conversationId,
      reason,
    });
  }

  const { error: conversationError } = await supabase
    .from("message_conversations")
    .update({
      blocked: false,
      reported: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (conversationError) {
    throw conversationError;
  }

  const { error: reportError } = await supabase
    .from("reports")
    .update({
      status: "open",
    })
    .eq("id", reportId);

  if (reportError) {
    throw reportError;
  }

  window.dispatchEvent(new Event("lforls:messages-updated"));
};

export const loadAdminPanelData = async () => {
  assertSupabase();

  const [items, users, claims, flags] = await Promise.all([
    listAdminItems(),
    listAdminUsers(),
    listAdminClaims(),
    listAdminFlags(),
  ]);

  const stats = {
    totalLostItems: items.filter((item) => item.typeLabel === "Lost").length,
    totalFoundItems: items.filter((item) => item.typeLabel === "Found").length,
    activeMatches: items.filter((item) => item.rawStatus === "matched").length,
    claimedItems: items.filter((item) => item.rawStatus === "claimed").length,
  };

  return {
    items,
    users,
    claims,
    flags,
    stats,
    dailyReports: groupReportsByDay(items),
    activityLogs: buildActivityLogs({ items, users, claims, flags }),
  };
};

export const updateAdminItemStatus = async (itemId, status) => {
  assertSupabase();

  const { error } = await supabase
    .from("items")
    .update({ status })
    .eq("id", itemId);
  if (error) throw error;

  notifyItemsUpdated();
};

export const deleteAdminItem = async (itemId) => {
  assertSupabase();

  const { error } = await supabase.from("items").delete().eq("id", itemId);
  if (error) throw error;

  notifyItemsUpdated();
};

export const updateAdminUserStatus = async (userId, status, options = {}) => {
  assertSupabase();

  const normalizedStatus = String(status || "active").toLowerCase();
  const payload = { status: normalizedStatus, suspended_until: null };

  if (normalizedStatus === "suspended") {
    const durationValue = Number(options.durationValue);
    const durationUnit = String(options.durationUnit || "hours").toLowerCase();

    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      throw new Error("Suspension duration must be greater than 0.");
    }

    const normalizedUnit = durationUnit === "days" ? "days" : "hours";
    const milliseconds =
      durationValue *
      (normalizedUnit === "days" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000);
    payload.suspended_until = new Date(Date.now() + milliseconds).toISOString();
  }

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId);
  if (error) throw error;

  return payload;
};

export const updateAdminUserProfile = async ({
  userId,
  fullName,
  email,
  department,
  yearSection,
}) => {
  assertSupabase();

  const payload = {
    id: userId,
    full_name: fullName?.trim() || "",
    email: email?.trim() || "",
    college_dept: department?.trim() || "",
    year_section: yearSection?.trim() || "",
  };

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });
  if (error) throw error;
};

export const updateAdminClaimStatus = async (claimId, status) => {
  assertSupabase();

  const { error } = await supabase
    .from("claims")
    .update({ status })
    .eq("id", claimId);
  if (error) throw error;
};

export const updateAdminFlagStatus = async (flagId, status) => {
  assertSupabase();

  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", flagId);
  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error(
        "No database-backed reports table is available for admin moderation yet.",
      );
    }
    throw error;
  }
};

export const removeFlaggedContent = async ({ flagId, itemId }) => {
  assertSupabase();

  const { error: reportError } = await supabase
    .from("reports")
    .update({ status: "content_removed" })
    .eq("id", flagId);

  if (reportError) {
    throw reportError;
  }

  if (itemId) {
    const { error: itemError } = await supabase
      .from("items")
      .update({ status: "content_removed" })
      .eq("id", itemId);

    if (itemError) {
      throw itemError;
    }
  }

  notifyItemsUpdated();
};

export const deleteAdminFlag = async (flagId) => {
  assertSupabase();

  const { error: rpcError } = await supabase.rpc("admin_delete_report", {
    target_report_id: flagId,
  });
  if (!rpcError) {
    return { success: true };
  }

  const { error } = await supabase.from("reports").delete().eq("id", flagId);
  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error(
        "No database-backed reports table is available for admin moderation yet.",
      );
    }

    throw error;
  }

  return { success: true };
};

export const deleteAdminUser = async (userId) => {
  assertSupabase();

  // Preferred path: database RPC.
  const { error: rpcError } = await supabase.rpc("admin_delete_user", {
    target_user_id: userId,
  });
  if (!rpcError) {
    return { success: true };
  }

  let response;
  try {
    response = await fetch(`${resetApiBaseUrl}/api/admin/delete-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });
  } catch {
    throw new Error(
      "Admin service is offline. Start the reset server and try again.",
    );
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || "Failed to delete user account.");
  }

  return body;
};

const buildWarningBody = ({
  templateType,
  customMessage,
  reason,
  itemName,
}) => {
  const subject = itemName || "this listing";
  const issue = reason || "the reported content";

  if (templateType === "custom") {
    const trimmed = String(customMessage || "").trim();
    if (trimmed) {
      return trimmed;
    }
  }

  if (templateType === "inappropriate") {
    return `Your report for ${subject} has been reviewed and a warning was issued for inappropriate content. Please update the listing to meet the community standards.`;
  }

  if (templateType === "false_report") {
    return `Your report for ${subject} has been reviewed. A warning was issued because the submission may be inaccurate. Please verify the details before posting again.`;
  }

  if (templateType === "spam") {
    return `Your report for ${subject} has been reviewed and a warning was issued for spam or abusive activity. Please keep future submissions clear and relevant.`;
  }

  return `Your report for ${subject} has been reviewed. A warning was issued based on ${issue}. Please review the listing details and make any needed corrections.`;
};

export const sendUserWarning = async ({
  flagId,
  userId,
  itemId,
  itemName,
  templateType,
  customMessage,
  reason,
}) => {
  assertSupabase();

  const { error } = await supabase
    .from("reports")
    .update({ status: "warned_user" })
    .eq("id", flagId);

  if (error) {
    throw error;
  }

  if (userId) {
    createNotification({
      type: "moderation",
      priority: "high",
      title: `Warning issued for ${itemName || "your report"}`,
      body: buildWarningBody({ templateType, customMessage, reason, itemName }),
      path: itemId ? `/details/${itemId}` : "/notifications",
      recipientId: userId,
      senderName: "Admin",
      senderId: "admin",
    });
  }

  return { success: true };
};
