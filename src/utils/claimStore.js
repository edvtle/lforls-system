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

export const getClaims = () => {
  ensureSeed();
  return parse(localStorage.getItem(CLAIMS_KEY), seedClaims).sort(bySubmittedTimeDesc);
};

export const createClaim = ({
  itemId,
  item,
  fullName,
  contact,
  collegeDept,
  programYear,
  routeTo = "admin-panel",
}) => {
  const claim = {
    id: `CLM-${Date.now().toString().slice(-6)}-${Math.random().toString(16).slice(2, 4).toUpperCase()}`,
    itemId: itemId || "unknown-item",
    item: item || "Unknown item",
    fullName: fullName.trim(),
    contact: contact.trim(),
    collegeDept: collegeDept.trim(),
    programYear: programYear.trim(),
    routeTo,
    status: "Pending",
    submittedAt: new Date().toISOString(),
  };

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
