import { supabase, isSupabaseConfigured } from "./supabaseClient";

const normalize = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenSet = (value = "") =>
  new Set(normalize(value).split(" ").filter(Boolean));

const jaccard = (left = "", right = "") => {
  const a = tokenSet(left);
  const b = tokenSet(right);

  if (!a.size || !b.size) {
    return 0;
  }

  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection += 1;
  });

  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
};

const locationScore = (left = "", right = "") => {
  const a = normalize(left);
  const b = normalize(right);

  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.7;
  return 0.2;
};

const dateScore = (leftDate, rightDate) => {
  if (!leftDate || !rightDate) return 0;

  const left = new Date(`${leftDate}T00:00:00`).getTime();
  const right = new Date(`${rightDate}T00:00:00`).getTime();
  if (Number.isNaN(left) || Number.isNaN(right)) return 0;

  const diffDays = Math.abs(left - right) / (1000 * 60 * 60 * 24);
  if (diffDays <= 1) return 1;
  if (diffDays <= 3) return 0.8;
  if (diffDays <= 7) return 0.55;
  if (diffDays <= 14) return 0.3;
  return 0;
};

const confidenceLabel = (score) => {
  if (score >= 90) return "very high confidence";
  if (score >= 75) return "high confidence";
  if (score >= 60) return "possible match";
  return "low confidence";
};

const computeScores = (left, right) => {
  const nameSimilarity = jaccard(left.item_name, right.item_name);
  const categoryMatch =
    normalize(left.category) === normalize(right.category) ? 1 : 0;
  const descriptionSimilarity = jaccard(left.description, right.description);
  const brandColorMatch =
    (normalize(left.brand) && normalize(left.brand) === normalize(right.brand)
      ? 0.5
      : 0) +
    (normalize(left.color) && normalize(left.color) === normalize(right.color)
      ? 0.5
      : 0);
  const identifierMatch = jaccard(left.identifiers, right.identifiers);
  const locationSimilarity = locationScore(
    left.location_text,
    right.location_text,
  );
  const timeSimilarity = dateScore(
    left.date_lost_or_found,
    right.date_lost_or_found,
  );

  const textScore =
    (nameSimilarity * 25 +
      categoryMatch * 15 +
      descriptionSimilarity * 15 +
      brandColorMatch * 10 +
      identifierMatch * 20) /
    85;

  const metadataScore =
    (categoryMatch * 55 + brandColorMatch * 20 + identifierMatch * 25) / 100;
  const imageScore = 0;
  const timeLocationScore =
    (locationSimilarity * 65 + timeSimilarity * 35) / 100;

  const finalScore = Math.round(
    (0.45 * textScore +
      0.2 * metadataScore +
      0.25 * imageScore +
      0.1 * timeLocationScore) *
      100,
  );

  return {
    finalScore,
    keywordScore: Math.round(textScore * 100),
    imageScore: Math.round(imageScore * 100),
    locationScore: Math.round(locationSimilarity * 100),
    timeScore: Math.round(timeSimilarity * 100),
    confidenceLabel: confidenceLabel(finalScore),
  };
};

const sanitizeFilename = (fileName = "file") =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

const assertSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
};

const buildItemPayload = ({
  reporterId,
  type,
  itemName,
  category,
  customCategory,
  description,
  color,
  brand,
  identifiers,
  locationText,
  contactMethod,
  contactValue,
  notifyOnMatch,
}) => ({
  reporter_id: reporterId,
  type,
  status: "open",
  item_name: itemName.trim(),
  category: category.trim() || "Others",
  custom_category: customCategory?.trim() || null,
  description: description.trim() || null,
  color: color?.trim() || null,
  brand: brand?.trim() || null,
  identifiers: identifiers?.trim() || null,
  location_text: locationText.trim() || null,
  date_reported: new Date().toISOString().slice(0, 10),
  date_lost_or_found: new Date().toISOString().slice(0, 10),
  contact_method: contactMethod || null,
  contact_value: contactValue?.trim() || null,
  notify_on_match: Boolean(notifyOnMatch),
});

const uploadItemImage = async ({ reporterId, itemId, file }) => {
  const safeName = sanitizeFilename(file.name || "upload.jpg");
  const storagePath = `${reporterId}/${itemId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("item-images")
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage
    .from("item-images")
    .getPublicUrl(storagePath);
  const publicUrl = publicData?.publicUrl || null;

  const { error: imageError } = await supabase.from("item_images").insert({
    item_id: itemId,
    storage_path: storagePath,
    public_url: publicUrl,
    is_primary: true,
  });

  if (imageError) throw imageError;

  return { storagePath, publicUrl };
};

const createMatchNotifications = async ({ currentItem, matchRows }) => {
  const highMatches = matchRows.filter((entry) => entry.finalScore >= 75);
  if (!highMatches.length) return;

  const uniqueRecipients = new Set([currentItem.reporter_id]);
  highMatches.forEach((entry) => {
    if (entry.otherReporterId) {
      uniqueRecipients.add(entry.otherReporterId);
    }
  });

  const notifications = Array.from(uniqueRecipients).map((userId) => ({
    user_id: userId,
    type: "match",
    title: "Potential match found",
    body: `We found ${highMatches.length} high-confidence match${highMatches.length > 1 ? "es" : ""} for a report.`,
    path: "/matches",
    priority: "high",
    read: false,
  }));

  const { error } = await supabase.from("notifications").insert(notifications);
  if (error) throw error;
};

const createMatchesForItem = async (currentItem) => {
  const oppositeType = currentItem.type === "lost" ? "found" : "lost";

  const { data: candidates, error: candidatesError } = await supabase
    .from("items")
    .select(
      "id, reporter_id, type, status, item_name, category, description, color, brand, identifiers, location_text, date_lost_or_found",
    )
    .eq("type", oppositeType)
    .in("status", ["open", "matched"])
    .neq("id", currentItem.id)
    .limit(200);

  if (candidatesError) throw candidatesError;

  const ranked = (candidates || [])
    .map((candidate) => {
      const score = computeScores(currentItem, candidate);
      return {
        candidate,
        ...score,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 10);

  if (!ranked.length) return [];

  const rows = ranked.map((entry) => ({
    lost_item_id:
      currentItem.type === "lost" ? currentItem.id : entry.candidate.id,
    found_item_id:
      currentItem.type === "found" ? currentItem.id : entry.candidate.id,
    keyword_score: entry.keywordScore,
    image_score: entry.imageScore,
    location_score: entry.locationScore,
    time_score: entry.timeScore,
    final_score: entry.finalScore,
    confidence_label: entry.confidenceLabel,
    status: "suggested",
  }));

  const { error: insertError } = await supabase.from("matches").insert(rows);
  if (insertError) throw insertError;

  const maxScore = ranked[0]?.finalScore || 0;
  await supabase
    .from("items")
    .update({ match_score: maxScore })
    .eq("id", currentItem.id);

  const notificationPayload = ranked.map((entry) => ({
    finalScore: entry.finalScore,
    otherReporterId: entry.candidate.reporter_id,
  }));

  await createMatchNotifications({
    currentItem,
    matchRows: notificationPayload,
  });

  return ranked;
};

export const submitItemReport = async ({ reporterId, type, payload, file }) => {
  assertSupabase();

  const itemPayload = buildItemPayload({
    reporterId,
    type,
    itemName: payload.itemName,
    category: payload.category,
    customCategory: payload.customCategory,
    description: payload.description,
    color: payload.color,
    brand: payload.brand,
    identifiers: payload.identifiers,
    locationText: payload.locationText,
    contactMethod: payload.contactMethod,
    contactValue: payload.contactValue,
    notifyOnMatch: payload.notifyOnMatch,
  });

  const { data: createdItem, error: insertError } = await supabase
    .from("items")
    .insert(itemPayload)
    .select(
      "id, reporter_id, type, status, item_name, category, description, color, brand, identifiers, location_text, date_lost_or_found",
    )
    .single();

  if (insertError) throw insertError;

  let uploadedImage = null;
  if (file instanceof File) {
    uploadedImage = await uploadItemImage({
      reporterId,
      itemId: createdItem.id,
      file,
    });
  }

  const matches = await createMatchesForItem(createdItem);

  return {
    item: createdItem,
    uploadedImage,
    matches,
  };
};
