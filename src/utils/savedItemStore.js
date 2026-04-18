const SAVED_ITEMS_KEY = "lforls:saved-item-ids";
export const savedItemsUpdatedEventName = "lforls:saved-items-updated";

const readSavedSet = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_ITEMS_KEY) || "[]");
    if (!Array.isArray(raw)) {
      return new Set();
    }
    return new Set(raw.map((value) => String(value)));
  } catch {
    return new Set();
  }
};

const persistSavedSet = (set) => {
  localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(Array.from(set)));
  window.dispatchEvent(new Event(savedItemsUpdatedEventName));
};

export const getSavedItemIds = () => Array.from(readSavedSet());

export const isItemSaved = (itemId) => readSavedSet().has(String(itemId));

export const toggleSavedItem = (itemId) => {
  const saved = readSavedSet();
  const key = String(itemId);
  if (saved.has(key)) {
    saved.delete(key);
  } else {
    saved.add(key);
  }
  persistSavedSet(saved);
  return saved.has(key);
};
