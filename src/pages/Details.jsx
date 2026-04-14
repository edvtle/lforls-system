import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
  faLocationDot,
  faMagnifyingGlassPlus,
  faTag,
  faShieldHalved,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import Modal from "../components/Modal";
import { claimsUpdatedEventName, createClaim, getClaims, updateClaimStatus as persistClaimStatus } from "../utils/claimStore";
import { getMarketplaceItems } from "../utils/itemStore";
import { updateUserReportByItemId } from "../utils/reportStore";
import { createNotification } from "../utils/notificationStore";

const getStatusTone = (status) => status.toLowerCase();

const formatDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const getModalConfig = (type) => {
  if (type === "claim") {
    return {
      title: "Verify Ownership",
      helper: "This helps confirm you are the rightful owner.",
      submitLabel: "Submit Claim",
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
      title: "Notify the owner",
      helper: "Alert the owner through the safe in-app workflow.",
      submitLabel: "Send alert",
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
  const [searchParams, setSearchParams] = useSearchParams();
  const marketplaceItems = getMarketplaceItems();
  const item = marketplaceItems.find((entry) => entry.id === itemId);

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

  const gallery = item.gallery?.length ? item.gallery : [item.image];

  const relatedItems = useMemo(() => {
    return marketplaceItems
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
  }, [item, marketplaceItems]);

  const [selectedImage, setSelectedImage] = useState(gallery[0]);
  const [activeModal, setActiveModal] = useState(null);
  const [saved, setSaved] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [fakeReported, setFakeReported] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [claimerModalOpen, setClaimerModalOpen] = useState(false);
  const [itemClaims, setItemClaims] = useState([]);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [formState, setFormState] = useState({
    fullName: "",
    contact: "",
    collegeDept: "",
    programYear: "",
    details: "",
  });

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
    setSelectedImage(gallery[0]);
    setActiveModal(null);
    setSubmissionStatus("");
  }, [gallery, itemId]);

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
    const refreshItemClaims = () => {
      const allClaims = getClaims();
      const claimsForCurrentItem = allClaims.filter((claim) => claim.itemId === item.id);
      setItemClaims(claimsForCurrentItem);
    };

    refreshItemClaims();
    window.addEventListener(claimsUpdatedEventName, refreshItemClaims);
    return () => window.removeEventListener(claimsUpdatedEventName, refreshItemClaims);
  }, [item.id]);

  const openModal = (type) => {
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
  };

  const pendingClaim = useMemo(
    () => itemClaims.find((claim) => claim.status === "Pending") || null,
    [itemClaims],
  );

  const approvedClaim = useMemo(
    () => itemClaims.find((claim) => claim.status === "Approved") || null,
    [itemClaims],
  );

  useEffect(() => {
    if (item.status === "Found") {
      setClaimed(Boolean(approvedClaim));
    }
  }, [approvedClaim, item.status]);

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

  const handleSubmit = (event) => {
    event.preventDefault();

    if (activeModal?.type === "claim") {
      createClaim({
        itemId: item.id,
        item: item.name,
        fullName: formState.fullName,
        contact: formState.contact,
        collegeDept: formState.collegeDept,
        programYear: formState.programYear,
        routeTo: item.status === "Found" ? "item-owner" : "admin-panel",
      });

      createNotification({
        type: "claim",
        priority: "high",
        title: "Claim verification submitted",
        body: "Claim submitted. Waiting for approval.",
        path: "/admin",
      });

      setSubmissionStatus("Claim submitted. Waiting for approval.");
      return;
    }

    setSubmissionStatus(
      activeModal?.type === "report"
        ? "Report sent. Review is queued and the listing remains hidden from direct contact."
        : "Request sent. The next step stays inside the app until verification is approved.",
    );
  };

  const statusTone = getStatusTone(item.status);
  const hasClaimRequest = item.status === "Found" && itemClaims.length > 0;
  const primaryActionLabel = item.status === "Lost" ? "This is my item" : hasClaimRequest ? "Claimed" : "Notify Owner";
  const secondaryActionLabel = item.status === "Lost" ? "Contact Finder" : "Not a match";
  const primaryActionType = item.status === "Lost" ? "claim" : hasClaimRequest ? "claimed-review" : "notify";
  const secondaryActionIcon = item.status === "Lost" ? "message" : "close";
  const secondaryActionType = item.status === "Lost" ? "contact" : null;

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

        <Link to="/browse" className="details-back-link">
          <Icon type="back" />
          Back to Browse
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
              <img src={selectedImage} alt={item.name} className="details-main-image" />
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
                  setSaved((current) => !current);
                  showSnackbar(!saved ? "Item saved" : "Item removed from saved");
                }}
                title={saved ? "Saved item" : "Save item"}
              >
                <Icon type="save" />
              </button>

              <button
                type="button"
                className={`details-ghost-button ${(claimed || Boolean(approvedClaim)) ? "details-ghost-active" : ""}`}
                disabled={item.status === "Found" && (claimed || Boolean(approvedClaim))}
                onClick={() => {
                  if (item.status === "Found") {
                    handleFoundItemClaimedClick();
                    return;
                  }

                  setClaimed((current) => !current);
                  showSnackbar(!claimed ? "Marked as claimed" : "Claim removed");
                }}
                title={
                  item.status === "Found"
                    ? (claimed || Boolean(approvedClaim))
                      ? "Already claimed"
                      : "Review claimer credentials"
                    : claimed
                      ? "Marked as claimed"
                      : "Mark as claimed"
                }
              >
                <Icon type="shield" />
                {item.status === "Found" ? "Claimed" : claimed ? "Claimed" : "Claim"}
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

          <div className="details-action-grid">
            <button
              type="button"
              className={`details-action-button ${item.status === "Lost" ? "details-action-primary-lost" : "details-action-primary-found"}`}
              onClick={() => {
                if (item.status === "Found" && hasClaimRequest) {
                  handleFoundItemClaimedClick();
                  return;
                }

                openModal(primaryActionType);
              }}
            >
              <Icon type="check" />
              {primaryActionLabel}
            </button>

            <button
              type="button"
              className="details-action-button details-action-secondary"
              onClick={() =>
                secondaryActionType
                  ? openModal(secondaryActionType)
                  : setSubmissionStatus("Marked as not a match. The item stays in review for other users.")
              }
            >
              <Icon type={secondaryActionIcon} />
              {secondaryActionLabel}
            </button>
          </div>

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
        onClose={closeModal}
        ariaLabel="Zoomed item image"
        overlayClassName="details-lightbox"
        panelClassName="details-lightbox-panel"
      >
        <button type="button" className="details-close-button" onClick={closeModal} aria-label="Close zoom view">
          <Icon type="close" />
        </button>
        <img src={selectedImage} alt={item.name} className="details-lightbox-image" />
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

              <button type="button" className="details-close-button" onClick={closeModal} aria-label="Close dialog">
                <Icon type="close" />
              </button>
            </div>

            {submissionStatus ? (
              <div className="details-form-success">
                <Icon type="check" />
                <p>{submissionStatus}</p>
                <button type="button" className="details-flow-submit" onClick={closeModal}>
                  Close
                </button>
              </div>
            ) : (
              <form className="details-flow-form" onSubmit={handleSubmit}>
                {activeModal?.type === "claim" ? (
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
                      <input
                        type="text"
                        value={formState.collegeDept}
                        onChange={(event) => setFormState((current) => ({ ...current, collegeDept: event.target.value }))}
                        placeholder="e.g., College of Computer Studies"
                        required
                      />
                    </label>

                    <label className="details-form-field">
                      <span>Program Year</span>
                      <input
                        type="text"
                        value={formState.programYear}
                        onChange={(event) => setFormState((current) => ({ ...current, programYear: event.target.value }))}
                        placeholder="e.g., BSIT - 3rd Year"
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
            <p className="details-flow-note">Review the claimant details before confirming this found item as claimed.</p>
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
