import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { homeItems } from "../data/items";

const getStatusTone = (status) => status.toLowerCase();

const formatDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
  const item = homeItems.find((entry) => entry.id === itemId);

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
    return homeItems
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

  const [selectedImage, setSelectedImage] = useState(gallery[0]);
  const [activeModal, setActiveModal] = useState(null);
  const [saved, setSaved] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [fakeReported, setFakeReported] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    proof: "",
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

  const openModal = (type) => {
    setSubmissionStatus("");
    setActiveModal({
      type,
      title:
        type === "claim"
          ? "Request to claim this item"
          : type === "contact"
            ? "Request controlled messaging"
            : type === "notify"
              ? "Notify the owner"
              : "Report fake item",
      helper:
        type === "claim"
          ? "Submit verification details. Contact stays hidden until the request is reviewed."
          : type === "contact"
            ? "Send a message through the app without exposing personal contact details."
            : type === "notify"
              ? "Alert the owner through the safe in-app workflow."
              : "Use this if the listing appears misleading or incorrect.",
      submitLabel:
        type === "report"
          ? "Send report"
          : type === "notify"
            ? "Send alert"
            : "Send request",
    });
  };

  const closeModal = () => {
    setActiveModal(null);
    setSubmissionStatus("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmissionStatus(
      activeModal?.type === "report"
        ? "Report sent. Review is queued and the listing remains hidden from direct contact."
        : "Request sent. The next step stays inside the app until verification is approved.",
    );
  };

  const statusTone = getStatusTone(item.status);
  const primaryActionLabel = item.status === "Lost" ? "This is my item" : "Notify Owner";
  const secondaryActionLabel = item.status === "Lost" ? "Contact Finder" : "Not a match";
  const primaryActionType = item.status === "Lost" ? "claim" : "notify";
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
                className={`details-ghost-button ${claimed ? "details-ghost-active" : ""}`}
                onClick={() => {
                  setClaimed((current) => !current);
                  showSnackbar(!claimed ? "Marked as claimed" : "Claim removed");
                }}
                title={claimed ? "Marked as claimed" : "Mark as claimed"}
              >
                <Icon type="shield" />
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
              onClick={() => openModal(primaryActionType)}
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
                <div className="details-form-grid">
                  <label className="details-form-field">
                    <span>Your name</span>
                    <input
                      type="text"
                      value={formState.name}
                      onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Full name"
                      required
                    />
                  </label>

                  <label className="details-form-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={formState.email}
                      onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                      placeholder="name@example.com"
                      required
                    />
                  </label>
                </div>

                <label className="details-form-field">
                  <span>Verification detail</span>
                  <input
                    type="text"
                    value={formState.proof}
                    onChange={(event) => setFormState((current) => ({ ...current, proof: event.target.value }))}
                    placeholder="Describe a unique identifier"
                  />
                </label>

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

                <p className="details-flow-note">
                  Full contact details stay hidden. The message is routed through the app and reviewed before any next step.
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

      {snackbar.visible && (
        <div className="details-snackbar">
          {snackbar.message}
        </div>
      )}
    </section>
  );
};

export default Details;
