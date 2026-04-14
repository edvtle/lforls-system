import { homeItems } from "../data/items";

const ITEMS_KEY = "lforls:reported-found-items";
const ITEMS_EVENT = "lforls:items-updated";

const parse = (rawValue, fallback) => {
  try {
    const parsed = JSON.parse(rawValue || "null");
    return parsed || fallback;
  } catch {
    return fallback;
  }
};

const readFoundItems = () => parse(localStorage.getItem(ITEMS_KEY), []);

const writeFoundItems = (items) => {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(ITEMS_EVENT));
};

export const getMarketplaceItems = () => {
  const reportedFoundItems = readFoundItems();
  return [...reportedFoundItems, ...homeItems];
};

export const createFoundItemReport = ({
  itemName,
  category,
  locationFound,
  description,
  color,
  brand,
  identifiers,
  uploadedImage,
}) => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const id = `user-found-${now.getTime()}`;
  const fallbackImage = "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1200&q=80";
  const isStableImage = typeof uploadedImage === "string" && uploadedImage.startsWith("data:");
  const imageSource = isStableImage ? uploadedImage : fallbackImage;

  const nextItem = {
    id,
    name: itemName.trim() || "Unnamed Found Item",
    category: category.trim() || "Others",
    location: locationFound.trim() || "Unknown",
    date,
    status: "Found",
    matchPercent: 74,
    brand: brand.trim() || "Not provided",
    color: color.trim() || "Not provided",
    serialNumber: identifiers.trim() || "Not available",
    image: imageSource,
    gallery: [imageSource],
    description: description.trim() || "No description provided.",
  };

  const existing = readFoundItems();
  writeFoundItems([nextItem, ...existing].slice(0, 60));
  return nextItem;
};

export const itemsUpdatedEventName = ITEMS_EVENT;
