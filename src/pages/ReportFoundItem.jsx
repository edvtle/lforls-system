import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCamera,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faCloudArrowUp,
  faCrop,
  faLocationDot,
  faPaperPlane,
  faWandMagic,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import SelectDropdown from "../components/ui/SelectDropdown";
import ImageCropModal from "../components/ImageCropModal";
import { useAuth } from "../context/AuthContext";
import { submitItemReport } from "../services/reportingService";

const TOTAL_STEPS = 4;

const categoryOptions = [
  "Electronics",
  "Wallet",
  "Bag",
  "ID",
  "Clothing",
  "Others",
];

const structuredCategories = [
  "Electronics",
  "Wallet",
  "Bag",
  "ID",
  "Clothing",
  "Others",
];

const locationOptions = [
  "Library",
  "Cafeteria",
  "Study Hall",
  "Gym Lobby",
  "Parking Area",
  "Main Hall",
  "Classroom",
  "Bus Stop",
];

const contactMethodOptions = ["Email", "Phone"];

const emptyForm = {
  itemName: "",
  category: "",
  customCategory: "",
  locationFound: "",
  description: "",
  color: "",
  brand: "",
  identifiers: "",
  custodyNote: "",
  contactMethod: "Email",
  contactValue: "",
  allowOwnerAlerts: true,
};

const getStepTitle = (step) => {
  if (step === 1) return "Basic Info";
  if (step === 2) return "Item Details";
  if (step === 3) return "Upload Image";
  return "Review & Submit";
};

const detectLikelyCategory = (fileName = "", itemName = "") => {
  const source = `${fileName} ${itemName}`.toLowerCase();
  if (source.includes("wallet")) return "Wallet";
  if (source.includes("bag") || source.includes("backpack")) return "Bag";
  if (source.includes("headphone") || source.includes("charger")) return "Electronics";
  if (source.includes("id") || source.includes("card")) return "ID";
  if (source.includes("shirt") || source.includes("clothing") || source.includes("jacket")) return "Clothing";
  return "Others";
};

const getResolvedCategory = (form) => (form.category === "Others" ? form.customCategory.trim() : form.category.trim());

const ReportFoundItem = () => {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [aiDetected, setAiDetected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropFileName, setCropFileName] = useState("upload.jpg");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!uploadedFile) {
      setImagePreview("");
      return undefined;
    }

    const url = URL.createObjectURL(uploadedFile);
    setImagePreview(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [uploadedFile]);

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateStep = (targetStep) => {
    const nextErrors = {};

    if (targetStep === 1) {
      if (!form.itemName.trim()) nextErrors.itemName = "This field is required";
      if (!form.category.trim()) nextErrors.category = "This field is required";
      if (form.category === "Others" && !form.customCategory.trim()) nextErrors.customCategory = "This field is required";
      if (!form.locationFound.trim()) nextErrors.locationFound = "This field is required";
    }

    if (targetStep === 2) {
      if (!form.description.trim()) nextErrors.description = "This field is required";
    }

    if (targetStep === 4) {
      if (!form.contactValue.trim()) nextErrors.contactValue = "This field is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) {
      return;
    }

    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(1, current - 1));
  };

  const handleFilePick = (file) => {
    if (!file) {
      return;
    }

    setUploadedFile(file);
    setCropFileName(file.name || "upload.jpg");
    setAiDetected(detectLikelyCategory(file.name, form.itemName));
  };

  const applyCroppedImage = (croppedFile) => {
    setUploadedFile(croppedFile);
    setAiDetected(detectLikelyCategory(croppedFile.name, form.itemName));
    setCropModalOpen(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    handleFilePick(event.dataTransfer.files?.[0]);
  };

  const removeImage = () => {
    setUploadedFile(null);
    setAiDetected("");
    setCropModalOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateStep(1) || !validateStep(2) || !validateStep(4)) {
      return;
    }

    if (!profile?.id) {
      setErrors((current) => ({ ...current, contactValue: current.contactValue || "You must be logged in." }));
      return;
    }

    setIsSubmitting(true);

    try {
      await submitItemReport({
        reporterId: profile.id,
        type: "found",
        payload: {
          itemName: form.itemName,
          category: getResolvedCategory(form),
          customCategory: form.category === "Others" ? form.customCategory : "",
          locationText: form.locationFound,
          description: form.description,
          color: form.color,
          brand: form.brand,
          identifiers: form.identifiers,
          custodyNote: form.custodyNote,
          contactMethod: form.contactMethod,
          contactValue: form.contactValue,
          notifyOnMatch: form.allowOwnerAlerts,
        },
        file: uploadedFile,
      });

      setSubmitted(true);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        contactValue: error?.message || "Unable to submit report.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="page-card report-lost-page report-found-page report-success">
        <p className="page-kicker">Found report submitted</p>
        <h2 className="page-title">Your found-item report is now visible for matching</h2>
        <p className="page-description">
          Great work. We will privately route verified owner requests through this report.
        </p>
        <button
          type="button"
          className="report-primary-button"
          onClick={() => {
            setForm(emptyForm);
            setErrors({});
            setUploadedFile(null);
            setAiDetected("");
            setStep(1);
            setSubmitted(false);
          }}
        >
          <FontAwesomeIcon icon={faCheck} />
          Submit another found item
        </button>
      </section>
    );
  }

  return (
    <>
    <section className="page-card report-lost-page report-found-page">
      <div className="report-head">
        <div>
          <p className="page-kicker">Lost and found report</p>
          <h2 className="page-title">Report Found Item</h2>
          <p className="page-description">
            Guided flow to register found items with complete evidence for accurate owner matching.
          </p>
        </div>

        <div className="report-progress-chip" aria-live="polite">
          <strong>Step {step} of 4</strong>
          <span>{getStepTitle(step)}</span>
        </div>
      </div>

      <div className="report-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <form className="report-form" onSubmit={handleSubmit}>
        {step === 1 ? (
          <section className="report-step-card" aria-label="Basic info">
            <h3>Basic Info</h3>
            <p>Capture what item was found and where it was picked up.</p>

            <div className="report-grid-two">
              <label className="report-field">
                <span>Item name</span>
                <input
                  type="text"
                  value={form.itemName}
                  onChange={(event) => updateField("itemName", event.target.value)}
                  placeholder="e.g., Black Wallet"
                />
                {errors.itemName ? <em>{errors.itemName}</em> : null}
              </label>

              <label className="report-field">
                <span>Category</span>
                <SelectDropdown
                  value={form.category}
                  onChange={(value) => {
                    updateField("category", value);
                    if (value !== "Others") {
                      updateField("customCategory", "");
                    }
                  }}
                  className="report-select"
                  options={[
                    { value: "", label: "Select category" },
                    ...categoryOptions.map((option) => ({ value: option, label: option })),
                  ]}
                />
                {errors.category ? <em>{errors.category}</em> : null}
              </label>
            </div>

            {form.category === "Others" ? (
              <label className="report-field">
                <span>Enter category name</span>
                <input
                  type="text"
                  value={form.customCategory}
                  onChange={(event) => updateField("customCategory", event.target.value)}
                  placeholder="Enter category name"
                />
                {errors.customCategory ? <em>{errors.customCategory}</em> : null}
              </label>
            ) : null}

            <label className="report-field">
              <span>Location found</span>
              <div className="report-input-with-icon">
                <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
                <input
                  type="text"
                  value={form.locationFound}
                  onChange={(event) => updateField("locationFound", event.target.value)}
                  placeholder="Describe where it was last seen..."
                  className="report-text-input"
                />
              </div>
              {errors.locationFound ? <em>{errors.locationFound}</em> : null}
            </label>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="report-step-card" aria-label="Item details">
            <h3>Item Details</h3>
            <p>Add condition, identifiers, and custody details to verify rightful ownership.</p>

            <label className="report-field">
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Describe condition, contents, and where exactly it was found"
                rows={4}
              />
              {errors.description ? <em>{errors.description}</em> : null}
            </label>

            <div className="report-grid-two">
              <label className="report-field">
                <span>Color</span>
                <input
                  type="text"
                  value={form.color}
                  onChange={(event) => updateField("color", event.target.value)}
                  placeholder="Black"
                />
              </label>

              <label className="report-field">
                <span>Brand</span>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(event) => updateField("brand", event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>

            <label className="report-field">
              <span>Unique identifiers</span>
              <textarea
                value={form.identifiers}
                onChange={(event) => updateField("identifiers", event.target.value)}
                placeholder="Stickers, scratches, serial number, tags"
                rows={3}
              />
            </label>

            <label className="report-field">
              <span>Current custody note</span>
              <input
                type="text"
                value={form.custodyNote}
                onChange={(event) => updateField("custodyNote", event.target.value)}
                placeholder="e.g., Kept at security office"
              />
            </label>

            <div className="report-suggestions report-similar">
              <p>
                <FontAwesomeIcon icon={faWandMagic} /> Matching candidates are generated from live lost reports in the database after submission.
              </p>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="report-step-card" aria-label="Upload image">
            <h3>Upload Image</h3>
            <p>Upload a clear image to improve matching confidence.</p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="report-hidden-input"
              onChange={(event) => handleFilePick(event.target.files?.[0])}
            />

            <button
              type="button"
              className={`report-upload-zone ${dragActive ? "report-upload-zone-active" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <FontAwesomeIcon icon={faCloudArrowUp} />
              <strong>Drag and drop an image here</strong>
              <span>or click to browse files / open camera</span>
            </button>

            {imagePreview ? (
              <div className="report-image-preview">
                <img src={imagePreview} alt="Uploaded item preview" />
                <div>
                  <p>{uploadedFile?.name}</p>
                  <div className="report-inline-actions">
                    <button type="button" onClick={() => fileInputRef.current?.click()}>
                      <FontAwesomeIcon icon={faCamera} /> Replace
                    </button>
                    <button type="button" onClick={() => setCropModalOpen(true)}>
                      <FontAwesomeIcon icon={faCrop} /> Crop
                    </button>
                    <button type="button" onClick={removeImage}>
                      <FontAwesomeIcon icon={faTrash} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {aiDetected ? (
              <div className="report-ai-note">
                <FontAwesomeIcon icon={faWandMagic} />
                <p>
                  Detected: <strong>{aiDetected}</strong>
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 4 ? (
          <section className="report-step-card" aria-label="Review and submit">
            <h3>Review & Submit</h3>
            <p>Confirm details before publishing this found-item report.</p>

            <div className="report-review-grid">
              <div>
                <span>Item name</span>
                <strong>{form.itemName || "-"}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{getResolvedCategory(form) || "-"}</strong>
              </div>
              <div>
                <span>Location found</span>
                <strong>{form.locationFound || "-"}</strong>
              </div>
              <div>
                <span>Brand</span>
                <strong>{form.brand || "-"}</strong>
              </div>
              <div>
                <span>Color</span>
                <strong>{form.color || "-"}</strong>
              </div>
              <div>
                <span>Custody</span>
                <strong>{form.custodyNote || "-"}</strong>
              </div>
            </div>

            <label className="report-field">
              <span>Preferred contact method</span>
              <SelectDropdown
                value={form.contactMethod}
                onChange={(value) => updateField("contactMethod", value)}
                className="report-select"
                options={contactMethodOptions}
              />
            </label>

            <label className="report-field">
              <span>{form.contactMethod === "Email" ? "Email address" : "Phone number"}</span>
              <input
                type={form.contactMethod === "Email" ? "email" : "tel"}
                value={form.contactValue}
                onChange={(event) => updateField("contactValue", event.target.value)}
                placeholder={form.contactMethod === "Email" ? "name@example.com" : "09XX XXX XXXX"}
              />
              {errors.contactValue ? <em>{errors.contactValue}</em> : null}
              <small>This stays private and is never shown publicly.</small>
            </label>

            <label className="report-check-field">
              <input
                type="checkbox"
                checked={form.allowOwnerAlerts}
                onChange={(event) => updateField("allowOwnerAlerts", event.target.checked)}
              />
              <span>Notify me automatically when potential owners are matched</span>
            </label>

            {imagePreview ? (
              <div className="report-review-image">
                <img src={imagePreview} alt="Report preview" />
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="report-actions">
          <button type="button" className="report-secondary-button" onClick={handleBack} disabled={step === 1}>
            <FontAwesomeIcon icon={faChevronLeft} /> Back
          </button>

          {step < TOTAL_STEPS ? (
            <button type="button" className="report-primary-button" onClick={handleNext}>
              Next <FontAwesomeIcon icon={faChevronRight} />
            </button>
          ) : (
            <button type="submit" className="report-primary-button">
              <FontAwesomeIcon icon={faPaperPlane} /> {isSubmitting ? "Submitting..." : "Submit report"}
            </button>
          )}
        </div>
      </form>
    </section>

      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={imagePreview}
        fileName={cropFileName}
        onCancel={() => {
          setCropModalOpen(false);
        }}
        onApply={applyCroppedImage}
      />
    </>
  );
};

export default ReportFoundItem;
