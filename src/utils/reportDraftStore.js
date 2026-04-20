const REPORT_DRAFT_PREFIX = "lforls:report-draft";

export const reportDraftUpdatedEventName = "lforls:report-draft-updated";

const getDraftKey = (reportType, userId = "anonymous") =>
  `${REPORT_DRAFT_PREFIX}:${reportType}:${userId || "anonymous"}`;

const readDraft = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const writeDraft = (key, draft) => {
  window.localStorage.setItem(key, JSON.stringify(draft));
  window.dispatchEvent(new Event(reportDraftUpdatedEventName));
};

const clearDraft = (key) => {
  window.localStorage.removeItem(key);
  window.dispatchEvent(new Event(reportDraftUpdatedEventName));
};

export const getReportDraft = ({ reportType, userId }) =>
  readDraft(getDraftKey(reportType, userId));

export const saveReportDraft = ({ reportType, userId, draft }) => {
  writeDraft(getDraftKey(reportType, userId), draft);
  return draft;
};

export const deleteReportDraft = ({ reportType, userId }) => {
  clearDraft(getDraftKey(reportType, userId));
};
