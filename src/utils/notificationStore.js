const STORAGE_KEY = "lforls:notifications";

const byTimeDesc = (left, right) => new Date(right.time).getTime() - new Date(left.time).getTime();

const readRaw = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeRaw = (entries) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event("lforls:notifications-updated"));
};

export const getNotifications = () => readRaw().sort(byTimeDesc);

export const getUnreadCount = () => getNotifications().filter((entry) => !entry.read).length;

export const createNotification = ({
  type = "system",
  title,
  body,
  priority = "normal",
  path = "/notifications",
}) => {
  const entry = {
    id: `n-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    type,
    title,
    body,
    priority,
    path,
    read: false,
    time: new Date().toISOString(),
  };

  const existing = readRaw();
  writeRaw([entry, ...existing].slice(0, 30));
  return entry;
};

export const markNotificationRead = (id) => {
  const next = readRaw().map((entry) => (entry.id === id ? { ...entry, read: true } : entry));
  writeRaw(next);
};

export const setNotificationReadStatus = (id, read) => {
  const next = readRaw().map((entry) => (entry.id === id ? { ...entry, read: Boolean(read) } : entry));
  writeRaw(next);
};

export const markAllNotificationsRead = () => {
  const next = readRaw().map((entry) => ({ ...entry, read: true }));
  writeRaw(next);
};
