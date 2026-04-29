import { isSupabaseConfigured, supabase } from "../services/supabaseClient";

const CLAIMS_KEY = "lforls:claims";
const CLAIMS_EVENT = "lforls:claims-updated";

const seedClaims = [
  {
    id: "CLM-301",
    itemId: "seed-item-1",
    item: "Black Jansport Backpack",
    fullName: "John Dela Cruz",
    contact: "john@example.com",
    collegeDept: "College of Computer Studies",
    programYear: "BSIT - 3rd Year",
    routeTo: "item-owner",
    ownerIdImageUrl: "",
    status: "Pending",
    submittedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "CLM-302",
    itemId: "seed-item-2",
    item: "Student ID - CCS",
    fullName: "Anne Lim",
    contact: "anne.lim@example.com",
    collegeDept: "College of Computer Studies",
    programYear: "BSCS - 2nd Year",
    routeTo: "admin-panel",
    ownerIdImageUrl: "",
    status: "Pending",
    submittedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
];

const parse = (rawValue, fallback) => {
  try {
    const parsed = JSON.parse(rawValue || "null");
    return parsed || fallback;
  } catch {
    return fallback;
  }
};

const readRaw = () => parse(localStorage.getItem(CLAIMS_KEY), null);

const writeRaw = (claims) => {
  localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
  window.dispatchEvent(new Event(CLAIMS_EVENT));
};

const ensureSeed = () => {
  const existing = readRaw();
  if (!existing) {
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(seedClaims));
  }
};

const bySubmittedTimeDesc = (left, right) =>
  new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();

const isClaimActive = (status) => String(status || "").trim().toLowerCase() !== "rejected";

const isSchemaMismatchError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("could not find the column") ||
    message.includes("relation") ||
    message.includes("does not exist")
  );
};

const removeMissingColumnFromPayload = (payload, error) => {
  const message = String(error?.message || "");
  const match = message.match(/'([^']+)'\s+column/i);
  const missingColumn = match?.[1];

  if (!missingColumn || !(missingColumn in payload)) {
    return null;
  }

  const nextPayload = { ...payload };
  delete nextPayload[missingColumn];
  return nextPayload;
};

const tryInsertPayload = async (basePayload) => {
  let payload = { ...basePayload };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from("claims")
      .insert(payload)
      .select("id, status")
      .maybeSingle();

    if (!error) {
      return {
        inserted: true,
        data: data || null,
      };
    }

    if (!isSchemaMismatchError(error)) {
      throw error;
    }

    const nextPayload = removeMissingColumnFromPayload(payload, error);
    if (!nextPayload) {
      break;
    }

    payload = nextPayload;
  }

  return {
    inserted: false,
    data: null,
  };
};

const insertClaimToSupabase = async (claim) => {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const attempts = [
    {
      item_id: claim.itemId,
      claimant_id: claim.claimantId,
      item_name: claim.item,
      full_name: claim.fullName,
      contact: claim.contact,
      college_dept: claim.collegeDept,
      program_year: claim.programYear,
      route_to: claim.routeTo,
      owner_id_image_url: claim.ownerIdImageUrl,
      status: "pending",
    },
    {
      item_id: claim.itemId,
      claimant_id: claim.claimantId,
      item_name: claim.item,
      full_name: claim.fullName,
      contact_value: claim.contact,
      college_dept: claim.collegeDept,
      program_year: claim.programYear,
      route_to: claim.routeTo,
      owner_id_image_url: claim.ownerIdImageUrl,
      status: "pending",
    },
    {
      item_id: claim.itemId,
      claimant_id: claim.claimantId,
      claimant_name: claim.fullName,
      contact_value: claim.contact,
      college_dept: claim.collegeDept,
      program_year: claim.programYear,
      route_to: claim.routeTo,
      owner_id_image_url: claim.ownerIdImageUrl,
      status: "pending",
    },
    {
      item_name: claim.item,
      claimant_id: claim.claimantId,
      full_name: claim.fullName,
      contact: claim.contact,
      college_dept: claim.collegeDept,
      program_year: claim.programYear,
      route_to: claim.routeTo,
      owner_id_image_url: claim.ownerIdImageUrl,
      status: "pending",
    },
    {
      claimant_id: claim.claimantId,
      claimant_name: claim.fullName,
      contact_value: claim.contact,
      college_dept: claim.collegeDept,
      program_year: claim.programYear,
      route_to: claim.routeTo,
      owner_id_image_url: claim.ownerIdImageUrl,
      status: "pending",
    },
    {
      claimant_id: claim.claimantId,
      full_name: claim.fullName,
      contact: claim.contact,
      college_dept: claim.collegeDept,
      program_year: claim.programYear,
      route_to: claim.routeTo,
      owner_id_image_url: claim.ownerIdImageUrl,
      status: "pending",
    },
    {
      claimant_id: claim.claimantId,
      full_name: claim.fullName,
      contact_value: claim.contact,
      college_dept: claim.collegeDept,
      program_year: claim.programYear,
      route_to: claim.routeTo,
      owner_id_image_url: claim.ownerIdImageUrl,
      status: "pending",
    },
    {
      item_name: claim.item,
      claimant_id: claim.claimantId,
      claimant_name: claim.fullName,
      contact_value: claim.contact,
      college_dept: claim.collegeDept,
      program_year: claim.programYear,
      route_to: claim.routeTo,
      owner_id_image_url: claim.ownerIdImageUrl,
      status: "pending",
    },
  ];

  for (const payload of attempts) {
    const result = await tryInsertPayload(payload);
    if (result.inserted) {
      return result.data || { id: "", status: "pending" };
    }
  }

  return null;
};

const findExistingRemoteClaimForItem = async (itemId) => {
  if (!isSupabaseConfigured || !supabase || !itemId) {
    return null;
  }

  const columnCandidates = ["item_id", "found_item_id", "listing_id"];

  for (const column of columnCandidates) {
    const { data, error } = await supabase
      .from("claims")
      .select("id, status")
      .eq(column, itemId)
      .limit(20);

    if (error) {
      if (isSchemaMismatchError(error)) {
        continue;
      }
      throw error;
    }

    const existing = (data || []).find((claim) => isClaimActive(claim?.status));
    if (existing) {
      return existing;
    }
  }

  return null;
};

const deleteRemoteClaimsByItemId = async (itemId) => {
  if (!isSupabaseConfigured || !supabase || !itemId) {
    return;
  }

  const columnCandidates = ["item_id", "found_item_id", "listing_id"];

  for (const column of columnCandidates) {
    const { error } = await supabase.from("claims").delete().eq(column, itemId);

    if (error && !isSchemaMismatchError(error)) {
      throw error;
    }
  }
};

export const getClaims = () => {
  ensureSeed();
  return parse(localStorage.getItem(CLAIMS_KEY), seedClaims).sort(bySubmittedTimeDesc);
};

export const removeClaimsByItemId = async (itemId) => {
  if (!itemId) {
    return;
  }

  const next = getClaims().filter((claim) => String(claim.itemId) !== String(itemId));
  writeRaw(next);

  await deleteRemoteClaimsByItemId(itemId);
  window.dispatchEvent(new Event(CLAIMS_EVENT));
};

export const createClaim = async ({
  itemId,
  item,
  fullName,
  contact,
  collegeDept,
  programYear,
  ownerIdImageUrl = "",
  claimantId,
  routeTo = "admin-panel",
}) => {
  let resolvedClaimantId = claimantId || "";

  if (!resolvedClaimantId && isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      throw error;
    }

    resolvedClaimantId = data?.user?.id || "";
  }

  if (isSupabaseConfigured && !resolvedClaimantId) {
    throw new Error("You must be logged in to submit ownership details.");
  }

  const existingLocalClaim = getClaims().find(
    (entry) => String(entry.itemId) === String(itemId) && isClaimActive(entry.status),
  );

  if (existingLocalClaim) {
    throw new Error("A claim submission for this item is already under admin review.");
  }

  const existingRemoteClaim = await findExistingRemoteClaimForItem(itemId);
  if (existingRemoteClaim) {
    throw new Error("A claim submission for this item is already under admin review.");
  }

  const claim = {
    id: `CLM-${Date.now().toString().slice(-6)}-${Math.random().toString(16).slice(2, 4).toUpperCase()}`,
    itemId: itemId || "unknown-item",
    claimantId: resolvedClaimantId || "anonymous-user",
    item: item || "Unknown item",
    fullName: fullName.trim(),
    contact: contact.trim(),
    collegeDept: collegeDept.trim(),
    programYear: programYear.trim(),
    ownerIdImageUrl: String(ownerIdImageUrl || "").trim(),
    routeTo,
    status: "Pending",
    submittedAt: new Date().toISOString(),
  };

  const remoteClaim = await insertClaimToSupabase(claim);

  if (isSupabaseConfigured && supabase && !remoteClaim) {
    throw new Error("Unable to save owner details to admin claims right now. Please try again.");
  }

  if (remoteClaim?.id) {
    claim.id = String(remoteClaim.id);
  }

  if (remoteClaim?.status) {
    claim.status = String(remoteClaim.status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  const next = [claim, ...getClaims()];
  writeRaw(next.slice(0, 60));
  return claim;
};

export const updateClaimStatus = (claimId, status) => {
  const next = getClaims().map((claim) =>
    claim.id === claimId
      ? {
          ...claim,
          status,
        }
      : claim,
  );

  writeRaw(next);
};

export const claimsUpdatedEventName = CLAIMS_EVENT;
