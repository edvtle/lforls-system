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

const REPORT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1200&q=80";

const isSchemaMismatchError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("could not find the column") ||
    message.includes("relation") ||
    message.includes("does not exist")
  );
};

const isRlsPolicyError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "42501" ||
    message.includes("row-level security") ||
    message.includes("violates row-level security policy")
  );
};

const toProfileReportCard = (item) => {
  const images = Array.isArray(item.item_images) ? item.item_images : [];
  const primary = images.find((entry) => entry.is_primary) || images[0];
  const hasCustomCategory = Boolean(
    item.custom_category && String(item.custom_category).trim(),
  );
  const categoryLabel = hasCustomCategory
    ? "Others"
    : item.category || "Others";

  const reportStatus =
    item.status === "claimed" || item.status === "resolved"
      ? "Claimed"
      : item.type === "found"
        ? "Found"
        : "Lost";

  return {
    id: item.id,
    itemId: item.id,
    source: "supabase",
    reportType: item.type,
    name: item.item_name || "Unnamed item",
    category: categoryLabel,
    categoryDisplay: item.custom_category || item.category || "Others",
    customCategory: item.custom_category || "",
    location: item.location_text || "Unknown",
    locationText: item.location_text || "",
    image: primary?.public_url || REPORT_FALLBACK_IMAGE,
    reportStatus,
    matchPercent: Math.max(0, Math.min(100, Number(item.match_score || 0))),
    path: "/matches",
    description: item.description || "",
    color: item.color || "",
    brand: item.brand || "",
    identifiers: item.identifiers || "",
    custodyNote: item.custody_note || "",
    contactMethod: item.contact_method || "Email",
    contactValue: item.contact_value || "",
    notifyOnMatch: Boolean(item.notify_on_match),
    createdAt: item.created_at || new Date().toISOString(),
  };
};

const richReportColumns =
  "id, reporter_id, type, status, item_name, category, custom_category, location_text, description, color, brand, identifiers, custody_note, contact_method, contact_value, notify_on_match, match_score, created_at, item_images(public_url, is_primary)";

const baseReportColumns =
  "id, reporter_id, type, status, item_name, category, location_text, description, match_score, created_at, item_images(public_url, is_primary)";

const loadUserReports = async (reporterId, columns, limit) =>
  supabase
    .from("items")
    .select(columns)
    .eq("reporter_id", reporterId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .then((result) => result);

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
  custodyNote,
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
  custody_note: custodyNote?.trim() || null,
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
  if (insertError) {
    if (isRlsPolicyError(insertError)) {
      return [];
    }
    throw insertError;
  }

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

  const baseItemPayload = {
    reporter_id: itemPayload.reporter_id,
    type: itemPayload.type,
    status: itemPayload.status,
    item_name: itemPayload.item_name,
    category: itemPayload.category,
    description: itemPayload.description,
    location_text: itemPayload.location_text,
    date_reported: itemPayload.date_reported,
    date_lost_or_found: itemPayload.date_lost_or_found,
  };

  const createItem = async (nextPayload) =>
    supabase
      .from("items")
      .insert(nextPayload)
      .select(
        "id, reporter_id, type, status, item_name, category, custom_category, description, color, brand, identifiers, custody_note, location_text, date_lost_or_found, contact_method, contact_value, notify_on_match",
      )
      .single();

  let createResult = await createItem(itemPayload);

  if (createResult.error && isSchemaMismatchError(createResult.error)) {
    createResult = await createItem(baseItemPayload);
  }

  const { data: createdItem, error: insertError } = createResult;

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

export const listUserItemReports = async ({ reporterId, limit = 100 }) => {
  assertSupabase();

  const primaryResult = await loadUserReports(
    reporterId,
    richReportColumns,
    limit,
  );
  const secondaryResult =
    primaryResult.error && isSchemaMismatchError(primaryResult.error)
      ? await loadUserReports(reporterId, baseReportColumns, limit)
      : null;

  const data = primaryResult.data || secondaryResult?.data || [];
  const error =
    primaryResult.error && !isSchemaMismatchError(primaryResult.error)
      ? primaryResult.error
      : secondaryResult?.error || null;

  if (error) throw error;

  return data.map(toProfileReportCard);
};

export const updateItemReport = async ({ reporterId, itemId, payload }) => {
  assertSupabase();

  const nextType =
    payload.reportStatus === "Found"
      ? "found"
      : payload.reportStatus === "Lost"
        ? "lost"
        : null;

  const nextStatus =
    payload.reportStatus === "Claimed" ? "claimed" : payload.status || "open";

  const updates = {
    status: nextStatus,
  };

  if (typeof payload.name === "string") {
    updates.item_name = payload.name.trim() || "Unnamed item";
  }

  if (typeof payload.category === "string") {
    updates.category = payload.category.trim() || "Others";
  }

  if (typeof payload.customCategory === "string") {
    updates.custom_category = payload.customCategory.trim() || null;
  }

  if (typeof payload.location === "string") {
    updates.location_text = payload.location.trim() || "Unknown";
  }

  if (typeof payload.description === "string") {
    updates.description = payload.description.trim() || null;
  }

  if (typeof payload.color === "string") {
    updates.color = payload.color.trim() || null;
  }

  if (typeof payload.brand === "string") {
    updates.brand = payload.brand.trim() || null;
  }

  if (typeof payload.identifiers === "string") {
    updates.identifiers = payload.identifiers.trim() || null;
  }

  if (typeof payload.custodyNote === "string") {
    updates.custody_note = payload.custodyNote.trim() || null;
  }

  if (typeof payload.contactMethod === "string") {
    updates.contact_method = payload.contactMethod.trim() || null;
  }

  if (typeof payload.contactValue === "string") {
    updates.contact_value = payload.contactValue.trim() || null;
  }

  if (typeof payload.notifyOnMatch === "boolean") {
    updates.notify_on_match = payload.notifyOnMatch;
  }

  if (nextType) {
    updates.type = nextType;
  }

  const baseUpdates = {
    status: updates.status,
  };

  if (typeof updates.item_name === "string") {
    baseUpdates.item_name = updates.item_name;
  }

  if (typeof updates.location_text === "string") {
    baseUpdates.location_text = updates.location_text;
  }

  if (typeof updates.category === "string") {
    baseUpdates.category = updates.category;
  }

  if (typeof updates.type === "string") {
    baseUpdates.type = updates.type;
  }

  const updateItem = async (nextUpdates) =>
    supabase
      .from("items")
      .update(nextUpdates)
      .eq("id", itemId)
      .eq("reporter_id", reporterId)
      .select(
        "id, reporter_id, type, status, item_name, category, custom_category, location_text, description, color, brand, identifiers, custody_note, contact_method, contact_value, notify_on_match, match_score, created_at, item_images(public_url, is_primary)",
      )
      .single();

  let updateResult = await updateItem(updates);

  if (updateResult.error && isSchemaMismatchError(updateResult.error)) {
    updateResult = await updateItem(baseUpdates);
  }

  const { data, error } = updateResult;

  if (error) throw error;

  return toProfileReportCard(data);
};

export const deleteItemReport = async ({ reporterId, itemId }) => {
  assertSupabase();

  const { data: ownedItem, error: ownedItemError } = await supabase
    .from("items")
    .select("id")
    .eq("id", itemId)
    .eq("reporter_id", reporterId)
    .maybeSingle();

  if (ownedItemError) throw ownedItemError;
  if (!ownedItem) {
    throw new Error("Report not found or not owned by current user.");
  }

  const { data: images, error: imagesQueryError } = await supabase
    .from("item_images")
    .select("storage_path")
    .eq("item_id", itemId);

  if (imagesQueryError) throw imagesQueryError;

  const storagePaths = (images || [])
    .map((entry) => entry.storage_path)
    .filter(Boolean);

  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage
      .from("item-images")
      .remove(storagePaths);

    if (storageError) throw storageError;
  }

  const { error: imageDeleteError } = await supabase
    .from("item_images")
    .delete()
    .eq("item_id", itemId);

  if (imageDeleteError) throw imageDeleteError;

  const { error: matchesDeleteError } = await supabase
    .from("matches")
    .delete()
    .or(`lost_item_id.eq.${itemId},found_item_id.eq.${itemId}`);

  if (matchesDeleteError) throw matchesDeleteError;

  const { error: itemDeleteError } = await supabase
    .from("items")
    .delete()
    .eq("id", itemId)
    .eq("reporter_id", reporterId);

  if (itemDeleteError) throw itemDeleteError;
};

export const submitItemListingReport = async ({
  reporterId,
  itemId,
  itemName,
  reason,
  details,
  severity = "medium",
}) => {
  assertSupabase();

  const safeReason = String(reason || "").trim();
  const safeDetails = String(details || "").trim();

  if (!safeReason || !safeDetails) {
    throw new Error("Please provide both reason and report details.");
  }

  const target = itemName ? `Item ${itemName} (${itemId})` : `Item ${itemId}`;

  const fullPayload = {
    reason: safeReason,
    target,
    severity,
    status: "open",
    body: safeDetails,
    user_id: reporterId || null,
    item_id: itemId || null,
    item_name: itemName || null,
  };

  const { error } = await supabase.from("reports").insert(fullPayload);

  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (
      message.includes("could not find the table") ||
      message.includes("relation") ||
      message.includes("does not exist")
    ) {
      throw new Error(
        "The reports table is missing from the database. Apply the latest migration and refresh the schema cache.",
      );
    }

    throw error;
  }
};
