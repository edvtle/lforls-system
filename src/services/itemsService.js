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
      "id, type, status, item_name, category, location_text, date_lost_or_found, match_score, created_at, item_images(public_url, is_primary)",
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

  return (data || []).map(toCardItem);
};
