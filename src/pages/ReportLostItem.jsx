import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCamera,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faCloudArrowUp,
  faLocationDot,
  faPaperPlane,
  faWandMagic,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import SelectDropdown from "../components/ui/SelectDropdown";
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

const structuredCategories = ["Electronics", "Wallet", "Bag", "ID", "Clothing", "Others"];

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
  locationLost: "",
  description: "",
  color: "",
  brand: "",
  identifiers: "",
  contactMethod: "Email",
  contactValue: "",
  notifyOnMatch: true,
};

const keywordCategoryMap = [
  { keyword: "wallet", category: "Wallet" },
  { keyword: "bag", category: "Bag" },
  { keyword: "backpack", category: "Bag" },
  { keyword: "headphone", category: "Electronics" },
  { keyword: "earbuds", category: "Electronics" },
  { keyword: "charger", category: "Electronics" },
  { keyword: "id", category: "ID" },
  { keyword: "card", category: "ID" },
  { keyword: "document", category: "ID" },
  { keyword: "shirt", category: "Clothing" },
  { keyword: "jacket", category: "Clothing" },
];

const getStepTitle = (step) => {
  if (step === 1) return "Basic Info";
  if (step === 2) return "Item Details";
  if (step === 3) return "Upload Image";
  return "Review & Submit";
};

const detectLikelyCategory = (fileName = "", itemName = "") => {
  const source = `${fileName} ${itemName}`.toLowerCase();
  const match = keywordCategoryMap.find((entry) => source.includes(entry.keyword));
  return match?.category || "Others";
};

const getResolvedCategory = (form) => (form.category === "Others" ? form.customCategory.trim() : form.category.trim());

const ReportLostItem = () => {
  const navigate = useNavigate();
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

  const suggestedCategories = useMemo(() => {
    const source = `${form.itemName} ${form.description}`.toLowerCase();
    if (!source.trim()) {
      return [];
    }

    const fromKeywords = keywordCategoryMap
      .filter((entry) => source.includes(entry.keyword))
      .map((entry) => entry.category);

    return [...new Set([...fromKeywords])]
      .map((category) => {
        if (["Accessories", "Personal"].includes(category)) return "Wallet";
        if (["Bags", "Bag"].includes(category)) return "Bag";
        if (["ID Cards", "Documents"].includes(category)) return "ID";
        if (["Electronics", "Clothing", "Others", "Wallet", "ID"].includes(category)) return category;
        return "Others";
      })
      .filter((category, index, list) => list.indexOf(category) === index)
      .slice(0, 4);
  }, [form.itemName, form.description]);

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
      if (!form.locationLost.trim()) nextErrors.locationLost = "This field is required";
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
    setAiDetected(detectLikelyCategory(file.name, form.itemName));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    handleFilePick(file);
  };

  const removeImage = () => {
    setUploadedFile(null);
    setAiDetected("");
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
      const result = await submitItemReport({
        reporterId: profile.id,
        type: "lost",
        payload: {
          itemName: form.itemName,
          category: getResolvedCategory(form),
          customCategory: form.category === "Others" ? form.customCategory : "",
          locationText: form.locationLost,
          description: form.description,
          color: form.color,
          brand: form.brand,
          identifiers: form.identifiers,
          contactMethod: form.contactMethod,
          contactValue: form.contactValue,
          notifyOnMatch: form.notifyOnMatch,
        },
        file: uploadedFile,
      });

      navigate("/matches", {
        state: {
          reportId: result.item.id,
          matchCount: result.matches.length,
        },
      });
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
      <section className="page-card report-lost-page report-success">
        <p className="page-kicker">Lost report submitted</p>
        <h2 className="page-title">Your report is now in matching queue</h2>
        <p className="page-description">
          We will keep your contact details private and notify you as soon as a relevant found item appears.
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
          Submit another report
        </button>
      </section>
    );
  }

  return (
    <section className="page-card report-lost-page">
      <div className="report-head">
        <div>
          <p className="page-kicker">Lost and found report</p>
          <h2 className="page-title">Report Lost Item</h2>
          <p className="page-description">
            Fast and guided flow to report what you lost so we can improve matching accuracy.
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
            <p>Tell us what item was lost and where it was last seen.</p>

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
              <span>Location lost</span>
              <div className="report-input-with-icon">
                <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
                <SelectDropdown
                  value={form.locationLost}
                  onChange={(value) => updateField("locationLost", value)}
                  className="report-select"
                  wrapperClassName="report-select-wrap"
                  options={[
                    { value: "", label: "Select location" },
                    ...locationOptions.map((option) => ({ value: option, label: option })),
                  ]}
                />
              </div>
              {errors.locationLost ? <em>{errors.locationLost}</em> : null}
            </label>

            {suggestedCategories.length ? (
              <div className="report-suggestions">
                <p>
                  <FontAwesomeIcon icon={faWandMagic} /> Suggested categories
                </p>
                <div>
                  {suggestedCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        if (structuredCategories.includes(category) && category !== "Others") {
                          updateField("category", category);
                          updateField("customCategory", "");
                        } else {
                          updateField("category", "Others");
                          updateField("customCategory", category);
                        }
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="report-step-card" aria-label="Item details">
            <h3>Item Details</h3>
            <p>Add distinctive attributes to improve matching confidence.</p>

            <label className="report-field">
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Describe size, material, and what makes it recognizable"
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
                placeholder="Stickers, scratches, serial number, engravings"
                rows={3}
              />
            </label>

            <div className="report-suggestions report-similar">
              <p>
                <FontAwesomeIcon icon={faCircleInfo} /> Matching suggestions will be generated from live database reports after submission.
              </p>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="report-step-card" aria-label="Upload image">
            <h3>Upload Image</h3>
            <p>Upload a clear image to improve match accuracy.</p>

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
            <p>Check all details before sending your report.</p>

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
                <span>Location</span>
                <strong>{form.locationLost || "-"}</strong>
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
                <span>Identifiers</span>
                <strong>{form.identifiers || "-"}</strong>
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
                checked={form.notifyOnMatch}
                onChange={(event) => updateField("notifyOnMatch", event.target.checked)}
              />
              <span>Notify me automatically when a potential match is found</span>
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
  );
};

export default ReportLostItem;
