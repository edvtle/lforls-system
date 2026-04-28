import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBookmark,
  faCalendarDays,
  faCheck,
  faChevronLeft,
  faCircleCheck,
  faCommentDots,
  faFileCircleExclamation,
  faIdBadge,
  faLocationDot,
  faMagnifyingGlassPlus,
  faGraduationCap,
  faBuildingUser,
  faTag,
  faShieldHalved,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import Modal from "../components/Modal";
import { claimsUpdatedEventName, createClaim, getClaims, updateClaimStatus as persistClaimStatus } from "../utils/claimStore";
import { getItemById } from "../services/itemsService";
import { submitItemListingReport } from "../services/reportingService";
import { updateItemReport } from "../services/reportingService";
import { updateUserReportByItemId } from "../utils/reportStore";
import { createNotification } from "../utils/notificationStore";
import { useAuth } from "../context/AuthContext";
import { createOrGetConversation, sendMessage } from "../utils/messagingStore";
import { isItemSaved, toggleSavedItem } from "../utils/savedItemStore";

const getStatusTone = (status) => String(status || "").toLowerCase();

const formatDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const normalizeReporterField = (value, fallback = "Not provided") => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
};

const collegeDepartmentOptions = [
  "Administrator",
  "College of Arts & Sciences",
  "College of Education",
  "College of Business & Accountancy",
  "College of Computer Studies",
  "College of Engineering",
  "College of Nursing",
  "College of International Hospitality Management",
];

const getModalConfig = (type) => {
  if (type === "claim") {
    return {
      title: "Verify Ownership",
      helper: "Enter the claimant's student details for secure ownership review.",
      submitLabel: "Submit owner details",
    };
  }

  if (type === "contact") {
    return {
      title: "Request controlled messaging",
      helper: "Send a message through the app without exposing personal contact details.",
      submitLabel: "Send request",
    };
  }

  if (type === "notify") {
    return {
      title: "This is my item",
      helper: "contact the finder to receive your item back.",
      submitLabel: "Notify finder",
    };
  }

  return {
    title: "Report fake item",
    helper: "Use this if the listing appears misleading or incorrect.",
    submitLabel: "Send report",
  };
};

const Icon = ({ type }) => {
  const icons = {
    back: faArrowLeft,
    zoom: faMagnifyingGlassPlus,
    category: faTag,
    location: faLocationDot,
    date: faCalendarDays,
    match: faCircleCheck,
    shield: faShieldHalved,
    message: faCommentDots,
    check: faCheck,
    flag: faFileCircleExclamation,
    save: faBookmark,
    close: faXmark,
  };

  const iconClasses = {
    back: "details-icon details-icon-back",
    zoom: "details-icon details-icon-zoom",
    category: "details-icon details-icon-category",
    location: "details-icon details-icon-location",
    date: "details-icon details-icon-date",
    match: "details-icon details-icon-match",
    shield: "details-icon details-icon-shield",
    message: "details-icon details-icon-message",
    check: "details-icon details-icon-check",
    flag: "details-icon details-icon-flag",
    save: "details-icon details-icon-save",
    close: "details-icon details-icon-close",
  };

  const icon = icons[type] ?? faChevronLeft;

  return (
    <FontAwesomeIcon
      icon={icon}
      fixedWidth
      className={iconClasses[type] ?? "details-icon"}
      aria-hidden="true"
      focusable="false"
    />
  );
};

const Details = () => {
  const { itemId } = useParams();
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadItem = async () => {
      try {
        const foundItem = await getItemById(itemId);
        if (mounted) {
          setItem(foundItem || null);
        }
      } catch {
        if (mounted) {
          setItem(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadItem();
    return () => {
      mounted = false;
    };
  }, [itemId]);

  const gallery = useMemo(() => {
    if (item?.gallery?.length) {
      return item.gallery;
    }

    if (item?.image) {
      return [item.image];
    }

    return [];
  }, [item?.gallery, item?.image]);

  const relatedItems = useMemo(() => {
    if (!item) {
      return [];
    }

    return []
      .filter((entry) => entry.id !== item.id)
      .map((entry) => {
        const score = [
          entry.category === item.category ? 3 : 0,
          entry.status === item.status ? 2 : 0,
          entry.location === item.location ? 2 : 0,
          Math.max(0, 100 - Math.abs(entry.matchPercent - item.matchPercent)) / 100,
        ].reduce((total, value) => total + value, 0);

        return { ...entry, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [item]);

  const [selectedImage, setSelectedImage] = useState(gallery[0] || "");
  const [activeModal, setActiveModal] = useState(null);
  const [saved, setSaved] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [fakeReported, setFakeReported] = useState(false);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [claimerModalOpen, setClaimerModalOpen] = useState(false);
  const [confirmClaimSubmitOpen, setConfirmClaimSubmitOpen] = useState(false);
  const [itemClaims, setItemClaims] = useState([]);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [formState, setFormState] = useState({
    fullName: "",
    contact: "",
    collegeDept: "",
    programYear: "",
    details: "",
    reportReason: "",
    reportSeverity: "medium",
    reportDetails: "",
    reportOtherReason: "",
  });
  const claimFormRef = useRef(null);

  const showSnackbar = (message) => {
    setSnackbar({ visible: true, message });
  };

  useEffect(() => {
    if (snackbar.visible) {
      const timer = setTimeout(() => setSnackbar({ visible: false, message: "" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [snackbar.visible]);

  useEffect(() => {
    setSelectedImage(gallery[0] || "");
    setActiveModal(null);
    setLightboxZoomed(false);
    setSubmissionStatus("");
  }, [gallery, itemId]);

  useEffect(() => {
    if (!item?.id) {
      return;
    }

    setSaved(isItemSaved(item.id));
  }, [item?.id]);

  useEffect(() => {
    if (!activeModal) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveModal(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeModal]);

  useEffect(() => {
    if (!item?.id) {
      setItemClaims([]);
      return undefined;
    }

    const refreshItemClaims = () => {
      const allClaims = getClaims();
      const claimsForCurrentItem = allClaims.filter((claim) => claim.itemId === item.id);
      setItemClaims(claimsForCurrentItem);
    };

    refreshItemClaims();
    window.addEventListener(claimsUpdatedEventName, refreshItemClaims);
    return () => window.removeEventListener(claimsUpdatedEventName, refreshItemClaims);
  }, [item?.id]);

  const openModal = (type) => {
    if (type === "contact" || type === "notify") {
      setFormState((current) => ({
        ...current,
        fullName: current.fullName || profile?.fullName || "",
        contact: current.contact || profile?.email || session?.user?.email || "",
      }));
    }

    setSubmissionStatus("");
    setActiveModal({ type, ...getModalConfig(type) });
  };

  useEffect(() => {
    if (searchParams.get("claim") !== "1") {
      return;
    }

    openModal("claim");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("claim");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const closeModal = () => {
    setActiveModal(null);
    setSubmissionStatus("");
    setConfirmClaimSubmitOpen(false);
  };

  const submitClaimVerification = async () => {
    if (!item) {
      return;
    }

    try {
      await createClaim({
        itemId: item.id,
        claimantId: currentUserId,
        item: item.name,
        fullName: formState.fullName,
        contact: formState.contact,
        collegeDept: formState.collegeDept,
        programYear: formState.programYear,
        routeTo:
          item.status === "Found" && isReportedByCurrentUser
            ? "admin-panel"
            : "item-owner",
      });

      if (item.status === "Found" && isReportedByCurrentUser && currentUserId) {
        await updateItemReport({
          reporterId: currentUserId,
          itemId: item.id,
          payload: { status: "claimed", reportStatus: "Claimed" },
        });

        updateUserReportByItemId(item.id, { reportStatus: "Claimed" });
        setClaimed(true);
      }

      createNotification({
        type: "claim",
        priority: "high",
        title: "Claim verification submitted",
        body: "Verification details saved and routed to claims review.",
        path: "/admin",
        recipientId: currentUserId,
      });

      if (item.status === "Found" && isReportedByCurrentUser) {
        setSubmissionStatus(
          "Ownership details have been submitted for admin review. This listing has been temporarily removed from Browse and will remain unavailable until an administrator reopens it.",
        );
      } else {
        setSubmissionStatus("Verification details saved and routed for review.");
      }
      setConfirmClaimSubmitOpen(false);
    } catch (error) {
      setConfirmClaimSubmitOpen(false);
      setSubmissionStatus(error?.message || "Unable to process your request right now.");
    }
  };

  const handleClaimSubmitRequest = (event) => {
    event.preventDefault();
    if (!claimFormRef.current) {
      return;
    }

    if (!claimFormRef.current.checkValidity()) {
      claimFormRef.current.reportValidity();
      return;
    }

    setConfirmClaimSubmitOpen(true);
  };

  const openDirectConversation = async () => {
    if (!item) {
      return;
    }

    if (!currentUserId) {
      showSnackbar("Please sign in to contact the reporter.");
      return;
    }

    if (!item.reporterId) {
      showSnackbar("Reporter account is unavailable for this item.");
      return;
    }

    if (item.reporterId === currentUserId) {
      showSnackbar("You cannot start a contact request on your own report.");
      return;
    }

    const fallbackName = item.reporterName || "reporter";
    const maskedIdentity = `${fallbackName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "user"}_***`;
    const conversationId = `conv-item-${item.id}`;

    try {
      const conversation = await createOrGetConversation({
        id: conversationId,
        title: `${item.status === "Lost" ? "Owner" : "Finder"} - ${item.name}`,
        context: item.name,
        maskedIdentity,
        itemId: item.id,
        currentUserId,
        otherUserId: item.reporterId,
      });

      navigate(`/messages?conv=${encodeURIComponent(conversation.id)}`);
    } catch (error) {
      showSnackbar(error?.message || "Unable to open messaging right now.");
    }
  };

  const pendingClaim = useMemo(
    () => itemClaims.find((claim) => claim.status === "Pending") || null,
    [itemClaims],
  );

  const approvedClaim = useMemo(
    () => itemClaims.find((claim) => claim.status === "Approved") || null,
    [itemClaims],
  );

  const itemLifecycleStatus = String(item?.rawStatus || item?.lifecycleStatus || "").toLowerCase();
  const isFoundItemClaimed = item?.status === "Found" && ["claimed", "resolved"].includes(itemLifecycleStatus);

  useEffect(() => {
    if (item?.status === "Found") {
      setClaimed(isFoundItemClaimed);
    }
  }, [isFoundItemClaimed, item?.status]);

  const handleFoundItemClaimedClick = () => {
    if (claimed) {
      showSnackbar("Item is already marked as claimed.");
      return;
    }

    setClaimerModalOpen(true);
  };

  const handleApproveClaim = () => {
    if (!pendingClaim) {
      showSnackbar("No pending claimer credentials found for this item.");
      return;
    }

    persistClaimStatus(pendingClaim.id, "Approved");
    updateUserReportByItemId(item.id, { reportStatus: "Claimed" });
    setClaimed(true);
    setClaimerModalOpen(false);
    setSubmissionStatus("Item marked as claimed after reviewing claimer credentials.");
    showSnackbar("Item marked as claimed.");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!item) {
      return;
    }

    if (activeModal?.type === "claim") {
      setConfirmClaimSubmitOpen(true);
      return;
    }

    try {
      if (activeModal?.type === "contact" || activeModal?.type === "notify") {
        if (!currentUserId) {
          setSubmissionStatus("Please sign in to contact the reporter.");
          return;
        }

        if (!item.reporterId) {
          setSubmissionStatus("Reporter account is unavailable, so messaging cannot be started for this item.");
          return;
        }

        if (item.reporterId === currentUserId) {
          setSubmissionStatus("You cannot start a contact request on your own report.");
          return;
        }

        const fallbackName = item.reporterName || "reporter";
        const maskedIdentity = `${fallbackName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "user"}_***`;
        const conversationId = `conv-item-${item.id}`;

        const conversation = await createOrGetConversation({
          id: conversationId,
          title: `${item.status === "Lost" ? "Owner" : "Finder"} - ${item.name}`,
          context: item.name,
          maskedIdentity,
          itemId: item.id,
          currentUserId,
          otherUserId: item.reporterId,
        });

        const starterText =
          activeModal?.type === "notify"
            ? `Hi, I believe ${item.name} is mine. Please let me know the next step so I can receive the item back safely.`
            : formState.details.trim() || `Hello, I am contacting you about ${item.name}.`;

        await sendMessage({
          conversationId: conversation.id,
          text: starterText,
          senderId: currentUserId,
        });

        if (activeModal?.type === "notify") {
          createNotification({
            type: "message",
            priority: "high",
            title: "New message from possible owner",
            body: `You received a message about ${item.name}.`,
            path: `/messages?conv=${encodeURIComponent(conversation.id)}`,
            recipientId: item.reporterId,
            senderId: currentUserId,
            senderName: profile?.fullName || session?.user?.email || "",
          });
        }

        navigate(`/messages?conv=${encodeURIComponent(conversation.id)}`);
        return;
      }

      if (activeModal?.type === "report") {
        if (!currentUserId) {
          setSubmissionStatus("Please sign in to submit a report.");
          return;
        }

        const reportReason = formState.reportReason === "Others" ? formState.reportOtherReason : formState.reportReason;

        await submitItemListingReport({
          reporterId: currentUserId,
          itemId: item.id,
          itemName: item.name,
          reason: reportReason,
          details: formState.reportDetails,
          severity: formState.reportSeverity,
        });

        setSubmissionStatus("Report submitted. Thank you for helping keep listings accurate and safe.");
        return;
      }
    } catch (error) {
      setSubmissionStatus(error?.message || "Unable to process your request right now.");
      return;
    }

    setSubmissionStatus(
      activeModal?.type === "report"
        ? "Report sent. Review is queued and the listing remains hidden from direct contact."
        : "Request sent. The next step stays inside the app until verification is approved.",
    );
  };

  if (loading) {
    return (
      <section className="page-card">
        <p className="page-kicker">Details</p>
        <h2 className="page-title">Loading item...</h2>
        <p className="page-description">Fetching item information from database.</p>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="page-card">
        <p className="page-kicker">Details</p>
        <h2 className="page-title">Item not found</h2>
        <p className="page-description">The item you opened is no longer available.</p>
        <Link to="/home" className="hero-button hero-button-lost inline-action-link">
          Back to Home
        </Link>
      </section>
    );
  }

  const statusTone = getStatusTone(item.status);
  const source = searchParams.get("from");
  const sourceMode = searchParams.get("mode") === "high" ? "high" : "all";
  const backTarget = source === "matches" ? `/matches?mode=${sourceMode}` : "/browse";
  const backLabel = source === "matches" ? "Back to Matches" : "Back to Browse";
  const currentUserId = session?.user?.id || null;
  const isReportedByCurrentUser = Boolean(currentUserId && item.reporterId && currentUserId === item.reporterId);
  const hasClaimRequest =
    item.status === "Found" && isReportedByCurrentUser && itemClaims.length > 0;
  const isLostItem = item.status === "Lost";
  const isFoundItem = item.status === "Found";
  const reporterName = normalizeReporterField(item.reporterName, "Unknown reporter");
  const reporterDepartment = normalizeReporterField(item.reporterDepartment);
  const reporterProgram = normalizeReporterField(item.reporterProgram);
  const reporterYearSection = normalizeReporterField(item.reporterYearSection);
  const reporterInitial = reporterName.charAt(0).toUpperCase();
  const safeSelectedImage = selectedImage || item.image || null;

  return (
    <section className="details-page">
      <div className="page-card details-page-header">
        <div>
          <p className="page-kicker">Item details</p>
          <h2 className="page-title">{item.name}</h2>
          <p className="page-description">
            Clear images, verified details, and controlled messaging help the user decide quickly and safely.
          </p>
        </div>

        <Link to={backTarget} className="details-back-link">
          <Icon type="back" />
          {backLabel}
        </Link>
      </div>

      <section className="details-layout">
        <div className="page-card details-gallery">
          <div className="details-gallery-main">
            <button
              type="button"
              className="details-main-image-button"
              onClick={() => setActiveModal({ type: "zoom" })}
              aria-label={`Zoom ${item.name} image`}
            >
              <img src={safeSelectedImage || undefined} alt={item.name} className="details-main-image" />
            </button>

            <span className={`details-status-badge details-status-${statusTone}`}>
              <Icon type="shield" />
              {item.status}
            </span>
          </div>

          {gallery.length > 1 ? (
            <div className="details-thumbnails" aria-label="Item image previews">
              {gallery.map((image, index) => (
                <button
                  key={`${item.id}-${index}`}
                  type="button"
                  className={`details-thumb ${selectedImage === image ? "details-thumb-active" : ""}`}
                  onClick={() => setSelectedImage(image)}
                  aria-label={`Preview image ${index + 1}`}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="details-gallery-foot">
            <div className="details-gallery-note">
              <Icon type="zoom" />
              Click the image to zoom and inspect details.
            </div>
          </div>
        </div>

        <div className="page-card details-copy">
          <div className="details-summary">
            <div>
              <p className="page-kicker">Item Details</p>
              <h3 className="page-title">{item.name}</h3>
            </div>

            <div className="details-secondary-actions">
              <button
                type="button"
                className={`details-ghost-button ${saved ? "details-ghost-active" : ""}`}
                onClick={() => {
                  const isNowSaved = toggleSavedItem(item.id);
                  setSaved(isNowSaved);
                  showSnackbar(isNowSaved ? "Item saved" : "Item removed from saved");
                }}
                title={saved ? "Saved item" : "Save item"}
              >
                <Icon type="save" />
              </button>

              <button
                type="button"
                className="details-ghost-button details-ghost-alert"
                onClick={() => {
                  setFakeReported((current) => !current);
                  openModal("report");
                }}
                title={fakeReported ? "Report submitted" : "Report fake item"}
              >
                <Icon type="flag" />
              </button>

              {isReportedByCurrentUser ? (
                <button
                  type="button"
                  className={`details-ghost-button ${claimed ? "details-ghost-active" : ""}`}
                  disabled={item.status === "Found" && claimed}
                  onClick={() => {
                    if (item.status === "Found") {
                      openModal("claim");
                      return;
                    }

                    setClaimed((current) => !current);
                    showSnackbar(!claimed ? "Marked as claimed" : "Claim removed");
                  }}
                  title={
                    item.status === "Found"
                      ? claimed
                        ? "Already claimed"
                        : "Verify ownership"
                      : claimed
                        ? "Marked as claimed"
                        : "Mark as claimed"
                  }
                >
                  <Icon type="shield" />
                  {item.status === "Found" ? (claimed ? "Claimed" : "Claim") : claimed ? "Claimed" : "Claim"}
                </button>
              ) : null}
            </div>

            <span className={`details-status-badge details-status-${statusTone}`}>
              <Icon type="shield" />
              {item.status}
            </span>
          </div>

          <dl className="details-meta-grid">
            <div>
              <dt>
                <Icon type="category" />
                Category
              </dt>
              <dd>{item.category}</dd>
            </div>
            <div>
              <dt>
                <Icon type="location" />
                Location
              </dt>
              <dd>{item.location}</dd>
            </div>
            <div>
              <dt>
                <Icon type="date" />
                Date reported
              </dt>
              <dd>{formatDate(item.date)}</dd>
            </div>
            <div>
              <dt>
                <Icon type="match" />
                Match
              </dt>
              <dd>{item.matchPercent}%</dd>
            </div>
          </dl>

          <section className="details-section details-reporter-section">
            <div className="details-reporter-card">
              <div className="details-reporter-head">
                <div className="details-reporter-identity">
                  <div className="details-reporter-avatar" aria-hidden="true">{reporterInitial}</div>
                  <div className="details-reporter-title-wrap">
                    <p className="page-kicker">Reporter information</p>
                    <h3>{reporterName}</h3>
                  </div>
                </div>
              </div>

              <dl className="details-reporter-grid">
                <div className="details-reporter-row">
                  <dt>
                    <FontAwesomeIcon icon={faBuildingUser} fixedWidth />
                    Department
                  </dt>
                  <dd className={reporterDepartment === "Not provided" ? "details-reporter-value-muted" : ""}>{reporterDepartment}</dd>
                </div>
                <div className="details-reporter-row">
                  <dt>
                    <FontAwesomeIcon icon={faGraduationCap} fixedWidth />
                    Program
                  </dt>
                  <dd className={reporterProgram === "Not provided" ? "details-reporter-value-muted" : ""}>{reporterProgram}</dd>
                </div>
                <div className="details-reporter-row">
                  <dt>
                    <FontAwesomeIcon icon={faIdBadge} fixedWidth />
                    Yr/Sec
                  </dt>
                  <dd className={reporterYearSection === "Not provided" ? "details-reporter-value-muted" : ""}>{reporterYearSection}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="details-match-panel">
            <div className="details-match-head">
              <div>
                <p className="page-kicker">Match information</p>
                <p className="details-match-label">This item matches your report</p>
              </div>
              <div className="details-match-score"></div>
            </div>

            <div className="details-similarity-grid">
              <div className="details-similarity-chip">
                <span>Color</span>
                <strong>{item.color || "Not provided"}</strong>
              </div>
              <div className="details-similarity-chip">
                <span>Type</span>
                <strong>{item.category}</strong>
              </div>
              <div className="details-similarity-chip">
                <span>Category</span>
                <strong>{item.category}</strong>
              </div>
            </div>

            <p className="details-match-copy">
              Review the image, compare identifiers, and use the safe in-app request flow before any contact is shared.
            </p>
          </section>

          <section className="details-section">
            <h3>Description</h3>
            <p className="details-description-text">{item.description}</p>
          </section>

          <section className="details-section">
            <h3>Additional information</h3>
            <dl className="details-additional-grid">
              <div>
                <dt>Brand</dt>
                <dd>{item.brand || "Not provided"}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>{item.color || "Not provided"}</dd>
              </div>
              <div>
                <dt>Serial number</dt>
                <dd>{item.serialNumber || "Not available"}</dd>
              </div>
              <div>
                <dt>Reference ID</dt>
                <dd>{item.id.toUpperCase()}</dd>
              </div>
            </dl>
          </section>

          {isReportedByCurrentUser ? (
            <p className="details-flow-note">You reported this item. Contact and claim actions are hidden for your own report.</p>
          ) : (
            <div className="details-action-grid">
              {isLostItem ? (
                <button
                  type="button"
                  className="details-action-button details-action-secondary details-action-button-contact-owner"
                  onClick={openDirectConversation}
                >
                  <Icon type="message" />
                  Contact Owner
                </button>
              ) : null}

              {isFoundItem ? (
                <>
                  <button
                    type="button"
                    className="details-action-button details-action-primary-lost"
                    onClick={() => openModal("notify")}
                  >
                    <Icon type="check" />
                    This is my item
                  </button>

                  <button
                    type="button"
                    className="details-action-button details-action-secondary"
                    onClick={openDirectConversation}
                  >
                    <Icon type="message" />
                    Contact Finder
                  </button>
                </>
              ) : null}
            </div>
          )}

          {submissionStatus ? <p className="details-flow-note">{submissionStatus}</p> : null}
        </div>
      </section>

      <section className="page-card details-related">
        <div className="details-related-head">
          <div>
            <p className="page-kicker">Similar items</p>
            <h3 className="page-title">Related items</h3>
          </div>
          <p className="details-related-meta">3 to 6 related results help users compare quickly.</p>
        </div>

        <div className="details-related-grid">
          {relatedItems.map((relatedItem) => (
            <Link key={relatedItem.id} to={`/details/${relatedItem.id}`} className="details-related-card">
              <img src={relatedItem.image} alt={relatedItem.name} />
              <div>
                <p className="page-kicker">{relatedItem.status}</p>
                <h4>{relatedItem.name}</h4>
                <p>{relatedItem.category}</p>
                <p>{relatedItem.location}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Modal
        isOpen={activeModal?.type === "zoom"}
        onClose={() => {
          setLightboxZoomed(false);
          closeModal();
        }}
        ariaLabel="Zoomed item image"
        overlayClassName="details-lightbox"
        panelClassName="details-lightbox-panel"
      >
        <button
          type="button"
          className="details-close-button"
          onClick={() => {
            setLightboxZoomed(false);
            closeModal();
          }}
          aria-label="Close zoom view"
        >
          <Icon type="close" />
        </button>
        <button
          type="button"
          className={`details-lightbox-image-button ${lightboxZoomed ? "details-lightbox-image-button-zoomed" : ""}`}
          onClick={() => setLightboxZoomed((current) => !current)}
          aria-label="Toggle image zoom"
        >
          <img src={safeSelectedImage || undefined} alt={item.name} className="details-lightbox-image" />
        </button>
      </Modal>

      <Modal
        isOpen={Boolean(activeModal && activeModal.type !== "zoom")}
        onClose={closeModal}
        ariaLabel={activeModal?.title || "Dialog"}
        overlayClassName="details-flow-modal"
        panelClassName="details-flow-panel"
      >
            <div className="details-modal-head">
              <div>
                <p className="page-kicker">Controlled flow</p>
                <h3 className="page-title">{activeModal?.title}</h3>
                <p className="details-flow-note">{activeModal?.helper}</p>
              </div>
              {!submissionStatus ? (
                <button type="button" className="details-close-button" onClick={closeModal} aria-label="Close dialog">
                  <Icon type="close" />
                </button>
              ) : null}
            </div>

            {submissionStatus ? (
              <div className="details-form-success details-form-success-claim">
                <Icon type="check" />
                <div className="details-form-success-copy">
                  <strong>Ownership details submitted</strong>
                  <p>{submissionStatus}</p>
                </div>
                <button type="button" className="details-flow-submit" onClick={closeModal}>
                  Close
                </button>
              </div>
            ) : (
              <form
                ref={activeModal?.type === "claim" ? claimFormRef : null}
                className="details-flow-form"
                onSubmit={activeModal?.type === "claim" ? handleClaimSubmitRequest : handleSubmit}
              >
                {activeModal?.type === "notify" ? (
                  <div className="details-form-success">
                    <p>contact the finder to receive your item back.</p>
                  </div>
                ) : activeModal?.type === "claim" ? (
                  <>
                    <div className="details-form-grid">
                      <label className="details-form-field">
                        <span>Full Name</span>
                        <input
                          type="text"
                          value={formState.fullName}
                          onChange={(event) => setFormState((current) => ({ ...current, fullName: event.target.value }))}
                          placeholder="Enter your full name"
                          required
                        />
                      </label>

                      <label className="details-form-field">
                        <span>Contact Number / Email</span>
                        <input
                          type="text"
                          value={formState.contact}
                          onChange={(event) => setFormState((current) => ({ ...current, contact: event.target.value }))}
                          placeholder="09xx xxx xxxx or name@email.com"
                          required
                        />
                      </label>
                    </div>

                    <label className="details-form-field">
                      <span>College Dept</span>
                      <select
                        value={formState.collegeDept}
                        onChange={(event) => setFormState((current) => ({ ...current, collegeDept: event.target.value }))}
                        required
                      >
                        <option value="">-- Select a college/department --</option>
                        {collegeDepartmentOptions.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="details-form-field">
                      <span>Program-Year/Section</span>
                      <input
                        type="text"
                        value={formState.programYear}
                        onChange={(event) => setFormState((current) => ({ ...current, programYear: event.target.value }))}
                        placeholder="e.g., BSIT - 1A"
                        required
                      />
                    </label>
                  </>
                ) : activeModal?.type === "report" ? (
                  <>
                    <div className={`details-form-grid ${formState.reportReason === "Others" ? "details-form-grid-2col" : ""}`}>
                      <label className="details-form-field">
                        <span>Report Reason</span>
                        <select
                          value={formState.reportReason}
                          onChange={(event) => setFormState((current) => ({ ...current, reportReason: event.target.value }))}
                          required
                        >
                          <option value="">Select reason</option>
                          <option value="Misleading Item Details">Misleading item details</option>
                          <option value="Possible Spam or Scam">Possible spam or scam</option>
                          <option value="Duplicate or Reposted Item">Duplicate or reposted item</option>
                          <option value="Wrong Category or Status">Wrong category or status</option>
                          <option value="Others">Others</option>
                        </select>
                      </label>

                      {formState.reportReason === "Others" && (
                        <label className="details-form-field">
                          <span>Specify reason</span>
                          <input
                            type="text"
                            value={formState.reportOtherReason}
                            onChange={(event) => setFormState((current) => ({ ...current, reportOtherReason: event.target.value }))}
                            placeholder="Please describe the issue"
                            required
                          />
                        </label>
                      )}
                    </div>

                    <label className="details-form-field">
                      <span>Priority</span>
                      <select
                        value={formState.reportSeverity}
                        onChange={(event) => setFormState((current) => ({ ...current, reportSeverity: event.target.value }))}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>

                    <label className="details-form-field">
                      <span>Details</span>
                      <textarea
                        value={formState.reportDetails}
                        onChange={(event) => setFormState((current) => ({ ...current, reportDetails: event.target.value }))}
                        placeholder="Describe why this item should be reviewed and include useful context."
                        rows={4}
                        required
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div className="details-form-grid">
                      <label className="details-form-field">
                        <span>Your name</span>
                        <input
                          type="text"
                          value={formState.fullName}
                          onChange={(event) => setFormState((current) => ({ ...current, fullName: event.target.value }))}
                          placeholder="Full name"
                          required
                        />
                      </label>

                      <label className="details-form-field">
                        <span>Email</span>
                        <input
                          type="email"
                          value={formState.contact}
                          onChange={(event) => setFormState((current) => ({ ...current, contact: event.target.value }))}
                          placeholder="name@example.com"
                          required
                        />
                      </label>
                    </div>

                    <label className="details-form-field">
                      <span>Message</span>
                      <textarea
                        value={formState.details}
                        onChange={(event) => setFormState((current) => ({ ...current, details: event.target.value }))}
                        placeholder="Share any verification notes or context"
                        rows={4}
                        required
                      />
                    </label>
                  </>
                )}

                <p className="details-flow-note">
                  {activeModal?.type === "claim"
                    ? "This helps confirm you are the rightful owner before release."
                    : activeModal?.type === "notify"
                      ? "A generated chat will be sent to the finder and you will be redirected to Messages."
                    : activeModal?.type === "report"
                      ? "Reports are reviewed by admin to keep the platform safe and trustworthy."
                    : "Full contact details stay hidden. The message is routed through the app and reviewed before any next step."}
                </p>

                <div className="details-flow-actions">
                  <button type="button" className="details-ghost-button" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="details-flow-submit">
                    {activeModal?.submitLabel}
                  </button>
                </div>
              </form>
            )}
      </Modal>

      <Modal
        isOpen={confirmClaimSubmitOpen}
        onClose={() => setConfirmClaimSubmitOpen(false)}
        ariaLabel="Confirm owner details submission"
        overlayClassName="details-flow-modal"
        panelClassName="details-flow-panel"
      >
        <div className="details-modal-head">
          <div>
            <p className="page-kicker">Confirm submission</p>
            <h3 className="page-title">Are you sure?</h3>
            <p className="details-flow-note">These details will be sent for admin review before release.</p>
          </div>
          <button
            type="button"
            className="details-close-button"
            onClick={() => setConfirmClaimSubmitOpen(false)}
            aria-label="Close dialog"
          >
            <Icon type="close" />
          </button>
        </div>

        <div className="details-flow-actions">
          <button
            type="button"
            className="details-ghost-button"
            onClick={() => setConfirmClaimSubmitOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="details-flow-submit"
            onClick={submitClaimVerification}
          >
            Confirm
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={claimerModalOpen}
        onClose={() => setClaimerModalOpen(false)}
        ariaLabel="Claimer credentials"
        overlayClassName="details-flow-modal"
        panelClassName="details-flow-panel"
      >
        <div className="details-modal-head">
          <div>
            <p className="page-kicker">Claim review</p>
            <h3 className="page-title">Claimer Credentials</h3>
            <p className="details-flow-note">Review the claimant information below before approving this item as claimed.</p>
          </div>

          <button type="button" className="details-close-button" onClick={() => setClaimerModalOpen(false)} aria-label="Close dialog">
            <Icon type="close" />
          </button>
        </div>

        {pendingClaim ? (
          <div className="details-flow-form">
            <div className="details-form-grid">
              <label className="details-form-field">
                <span>Name</span>
                <input type="text" value={pendingClaim.fullName || ""} readOnly />
              </label>

              <label className="details-form-field">
                <span>Email / Contact Number</span>
                <input type="text" value={pendingClaim.contact || ""} readOnly />
              </label>

              <label className="details-form-field">
                <span>College Dept</span>
                <input type="text" value={pendingClaim.collegeDept || ""} readOnly />
              </label>

              <label className="details-form-field">
                <span>Program Year</span>
                <input type="text" value={pendingClaim.programYear || ""} readOnly />
              </label>
            </div>

            <div className="details-flow-actions">
              <button type="button" className="details-ghost-button" onClick={() => setClaimerModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="details-flow-submit" onClick={handleApproveClaim}>
                Mark as Claimed
              </button>
            </div>
          </div>
        ) : (
          <div className="details-form-success">
            <Icon type="shield" />
            <p>No pending claimer credentials found for this item.</p>
            <button type="button" className="details-flow-submit" onClick={() => setClaimerModalOpen(false)}>
              Close
            </button>
          </div>
        )}
      </Modal>

      {snackbar.visible && (
        <div className="details-snackbar">
          {snackbar.message}
        </div>
      )}
    </section>
  );
};

export default Details;
