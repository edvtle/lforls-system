const REPORTS_KEY = "lforls:user-reports";
const REPORTS_EVENT = "lforls:reports-updated";

const parse = (rawValue, fallback) => {
  try {
    const parsed = JSON.parse(rawValue || "null");
    return parsed || fallback;
  } catch {
    return fallback;
  }
};

const readReports = () => parse(localStorage.getItem(REPORTS_KEY), []);

const writeReports = (reports) => {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  window.dispatchEvent(new Event(REPORTS_EVENT));
};

const sortByNewest = (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

export const getUserReports = () => readReports().sort(sortByNewest);

export const createUserReport = ({
  type,
  itemId = "",
  itemName = "",
  category = "Others",
  location = "Unknown",
  image = "",
  reportStatus = "Found",
  path = "/profile",
  description = "",
}) => {
  const report = {
    id: `RPT-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    type,
    itemId,
    name: itemName,
    category,
    location,
    image,
    reportStatus,
    path,
    description,
    createdAt: new Date().toISOString(),
  };

  const next = [report, ...readReports()].slice(0, 60);
  writeReports(next);
  return report;
};

export const updateUserReportByItemId = (itemId, patch) => {
  const next = readReports().map((report) => (report.itemId === itemId ? { ...report, ...patch } : report));
  writeReports(next);
};

export const updateUserReportById = (reportId, patch) => {
  const next = readReports().map((report) => (report.id === reportId ? { ...report, ...patch } : report));
  writeReports(next);
};

export const deleteUserReportById = (reportId) => {
  const next = readReports().filter((report) => report.id !== reportId);
  writeReports(next);
};

export const reportsUpdatedEventName = REPORTS_EVENT;
