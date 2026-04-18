import { supabase, isSupabaseConfigured } from "./supabaseClient";

const ITEM_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1200&q=80";

const toCardItem = (item) => {
  const images = Array.isArray(item.item_images) ? item.item_images : [];
  const primary = images.find((entry) => entry.is_primary) || images[0];

  return {
    id: item.id,
    name: item.item_name || "Unnamed item",
    category: item.category || "Others",
    location: item.location_text || "Unknown",
    date: item.date_lost_or_found || item.created_at?.slice(0, 10) || "",
    status: item.type === "found" ? "Found" : "Lost",
    matchPercent: Math.max(0, Math.min(100, Number(item.match_score || 0))),
    image: primary?.public_url || ITEM_FALLBACK_IMAGE,
    description: item.description || "",
    color: item.color || "",
    brand: item.brand || "",
    serialNumber: item.identifiers || "",
    reporterId: item.reporter_id || null,
    reporterName: item.reporterName || "Unknown reporter",
    reporterEmail: item.reporterEmail || "",
    reporterDepartment: item.reporterDepartment || "Not provided",
    reporterProgram: item.reporterProgram || "Not provided",
    reporterYearSection: item.reporterYearSection || "Not provided",
  };
};

const applySearch = (query, search) => {
  const normalized = search.trim();
  if (!normalized) {
    return query;
  }

  const safe = normalized.replace(/,/g, " ");
  return query.or(
    [
      `item_name.ilike.%${safe}%`,
      `category.ilike.%${safe}%`,
      `description.ilike.%${safe}%`,
      `location_text.ilike.%${safe}%`,
    ].join(","),
  );
};

export const listRecentItems = async ({
  search = "",
  category = "All Categories",
  location = "All Locations",
  date = "All Dates",
  limit = 80,
} = {}) => {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  let query = supabase
    .from("items")
    .select(
      "id, reporter_id, type, status, item_name, category, description, color, brand, identifiers, location_text, date_lost_or_found, match_score, created_at, item_images(public_url, is_primary)",
    )
    .in("status", ["open", "matched", "claimed", "resolved"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category !== "All Categories") {
    query = query.eq("category", category);
  }

  if (location !== "All Locations") {
    query = query.eq("location_text", location);
  }

  if (date !== "All Dates") {
    query = query.eq("date_lost_or_found", date);
  }

  query = applySearch(query, search);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = data || [];
  const reporterIds = [
    ...new Set(rows.map((item) => item.reporter_id).filter(Boolean)),
  ];
  const reporterMap = new Map();

  if (reporterIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, college_dept, program, year_section")
      .in("id", reporterIds);

    if (profilesError) {
      throw profilesError;
    }

    (profiles || []).forEach((profile) => {
      reporterMap.set(profile.id, {
        name: profile.full_name || "Unknown reporter",
        email: profile.email || "",
        department: profile.college_dept || "Not provided",
        program: profile.program || "Not provided",
        yearSection: profile.year_section || "Not provided",
      });
    });
  }

  return rows.map((item) => {
    const reporter = reporterMap.get(item.reporter_id);
    return toCardItem({
      ...item,
      reporterName: reporter?.name || "Unknown reporter",
      reporterEmail: reporter?.email || "",
      reporterDepartment: reporter?.department || "Not provided",
      reporterProgram: reporter?.program || "Not provided",
      reporterYearSection: reporter?.yearSection || "Not provided",
    });
  });
};
