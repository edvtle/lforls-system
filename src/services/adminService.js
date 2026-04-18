import { supabase, isSupabaseConfigured } from "./supabaseClient";

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

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10) || "N/A";
  }
  return date.toISOString().slice(0, 10);
};

const mapItem = (item) => {
  const images = Array.isArray(item.item_images) ? item.item_images : [];
  const primary = images.find((entry) => entry.is_primary) || images[0];

  return {
    id: item.id,
    image: primary?.public_url || ITEM_FALLBACK_IMAGE,
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
  reportsCount: Number(profile.items?.[0]?.count || 0),
  status: formatLabel(profile.status || "active"),
  rawStatus: profile.status || "active",
});

const mapClaim = (claim) => ({
  id: claim.id,
  item: claim.items?.item_name || claim.item_name || "Unknown item",
  fullName: claim.full_name || claim.claimant_name || "Unknown claimant",
  contact: claim.contact || claim.contact_value || "N/A",
  collegeDept: claim.college_dept || "N/A",
  programYear: claim.program_year || "N/A",
  routeTo: claim.route_to || "admin-panel",
  status: formatLabel(claim.status || "pending"),
  rawStatus: claim.status || "pending",
});

const mapFlag = (flag) => ({
  id: flag.id,
  reason: flag.reason || flag.title || "Reported issue",
  target: flag.target || flag.body || "No target details",
  severity: formatLabel(flag.severity || flag.priority || "medium"),
  status: formatLabel(flag.status || "open"),
  rawStatus: flag.status || "open",
});

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

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, college_dept, year_section, status, items(count)",
    )
    .order("full_name", { ascending: true })
    .limit(200);

  if (error) throw error;

  return (data || []).map(mapUser);
};

export const listAdminClaims = async () => {
  assertSupabase();

  const { data, error } = await supabase
    .from("claims")
    .select(
      "id, full_name, claimant_name, contact, contact_value, college_dept, program_year, route_to, status, item_name, items(item_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return (data || []).map(mapClaim);
};

export const listAdminFlags = async () => {
  assertSupabase();

  const { data, error } = await supabase
    .from("reports")
    .select("id, reason, target, severity, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return (data || []).map(mapFlag);
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
};

export const deleteAdminItem = async (itemId) => {
  assertSupabase();

  const { error } = await supabase.from("items").delete().eq("id", itemId);
  if (error) throw error;
};

export const updateAdminUserStatus = async (userId, status) => {
  assertSupabase();

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId);
  if (error) throw error;
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
    full_name: fullName?.trim() || "",
    email: email?.trim() || "",
    college_dept: department?.trim() || "",
    year_section: yearSection?.trim() || "",
  };

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId);
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
