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
  faCrop,
  faLocationDot,
  faPaperPlane,
  faWandMagic,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import Modal from "../components/Modal";
import SelectDropdown from "../components/ui/SelectDropdown";
import ImageCropModal from "../components/ImageCropModal";
import { useAuth } from "../context/AuthContext";
import { submitItemReport } from "../services/reportingService";
import {
  deleteReportDraft,
  getReportDraft,
  saveReportDraft,
} from "../utils/reportDraftStore";

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

const isEmailContactMethod = (value) => String(value || "").toLowerCase() === "email";

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });

const dataUrlToFile = async (dataUrl, fileName) => {
  if (!dataUrl) {
    return null;
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName || "upload.jpg", { type: blob.type || "image/jpeg" });
};

const ReportLostItem = () => {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [draftImageDataUrl, setDraftImageDataUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [aiDetected, setAiDetected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [saveDraftNotice, setSaveDraftNotice] = useState("");
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropFileName, setCropFileName] = useState("upload.jpg");
  const [draftRestoreOpen, setDraftRestoreOpen] = useState(false);
  const [draftRestoreData, setDraftRestoreData] = useState(null);
  const [draftCheckedUserId, setDraftCheckedUserId] = useState("");
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

  const accountEmail = profile?.email || session?.user?.email || "";
  const reportDraftUserId = profile?.id || session?.user?.id || "anonymous";

  useEffect(() => {
    if (!reportDraftUserId || draftCheckedUserId === reportDraftUserId) {
      return;
    }

    const draft = getReportDraft({ reportType: "lost", userId: reportDraftUserId });
    setDraftCheckedUserId(reportDraftUserId);

    if (draft) {
      setDraftRestoreData(draft);
      setDraftRestoreOpen(true);
      return;
    }

    setDraftRestoreData(null);
    setDraftRestoreOpen(false);
    setDraftImageDataUrl("");
    setAiDetected("");
  }, [draftCheckedUserId, reportDraftUserId]);

  useEffect(() => {
    if (!draftRestoreData || !draftRestoreOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setDraftRestoreOpen(false);
        setDraftRestoreData(null);
        deleteReportDraft({ reportType: "lost", userId: reportDraftUserId });
        setIsDraftDirty(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draftRestoreData, draftRestoreOpen]);

  const handleContactMethodChange = (value) => {
    updateField("contactMethod", value);
    if (isEmailContactMethod(value) && accountEmail) {
      updateField("contactValue", accountEmail);
    }
  };

  const persistDraft = () => {
    if (submitted) {
      return;
    }

    saveReportDraft({
      reportType: "lost",
      userId: reportDraftUserId,
      draft: {
        step,
        form,
        imageDataUrl: draftImageDataUrl,
        imageName: cropFileName,
        aiDetected,
        savedAt: new Date().toISOString(),
      },
    });
  };

  useEffect(() => {
    if (!draftRestoreData || draftRestoreOpen) {
      return undefined;
    }

    const restoreDraft = async () => {
      setForm({ ...emptyForm, ...(draftRestoreData.form || {}) });
      setStep(Math.min(TOTAL_STEPS, Math.max(1, Number(draftRestoreData.step) || 1)));
      setAiDetected(draftRestoreData.aiDetected || "");
      setCropFileName(draftRestoreData.imageName || "upload.jpg");
      setErrors({});

      if (draftRestoreData.imageDataUrl) {
        try {
          const restoredFile = await dataUrlToFile(
            draftRestoreData.imageDataUrl,
            draftRestoreData.imageName || "upload.jpg",
          );
          setUploadedFile(restoredFile);
          setDraftImageDataUrl(draftRestoreData.imageDataUrl);
          setImagePreview(draftRestoreData.imageDataUrl);
        } catch {
          setUploadedFile(null);
          setDraftImageDataUrl(draftRestoreData.imageDataUrl);
          setImagePreview(draftRestoreData.imageDataUrl);
        }
      } else {
        setUploadedFile(null);
        setDraftImageDataUrl("");
        setImagePreview("");
      }
    };

    restoreDraft().finally(() => {
      setDraftRestoreOpen(false);
      setDraftRestoreData(null);
    });
  }, [draftRestoreData, draftRestoreOpen]);

  useEffect(() => {
    if (!isDraftDirty || submitted || draftRestoreOpen || draftRestoreData) {
      return;
    }

    if (draftCheckedUserId === reportDraftUserId) {
      persistDraft();
    }
  }, [draftImageDataUrl, form, step, aiDetected, isDraftDirty, submitted, draftRestoreOpen, draftRestoreData, reportDraftUserId, draftCheckedUserId]);

  useEffect(() => {
    if (step !== 4 || !accountEmail || !isEmailContactMethod(form.contactMethod) || form.contactValue) {
      return;
    }

    setForm((current) => ({ ...current, contactValue: accountEmail }));
  }, [accountEmail, form.contactMethod, form.contactValue, step]);

  useEffect(() => {
    if (!saveDraftNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setSaveDraftNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [saveDraftNotice]);

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);

  const hasDraftableInput = useMemo(() => {
    const hasTextInput = Object.entries(form).some(([key, value]) => {
      const defaultValue = emptyForm[key];

      if (typeof value === "string") {
        return value.trim() !== String(defaultValue ?? "").trim();
      }

      if (typeof value === "boolean") {
        return value !== defaultValue;
      }

      return value !== null && value !== undefined && value !== defaultValue;
    });

    return hasTextInput || Boolean(uploadedFile) || Boolean(draftImageDataUrl);
  }, [draftImageDataUrl, form, uploadedFile]);

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
    setIsDraftDirty(true);
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
      if (
        !nextErrors.contactValue &&
        isEmailContactMethod(form.contactMethod) &&
        !/^[^\s@]+@[^\s@]+$/.test(form.contactValue.trim())
      ) {
        nextErrors.contactValue = "Please enter a valid email address.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) {
      return;
    }

    setIsDraftDirty(true);
    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  };

  const handleBack = () => {
    setIsDraftDirty(true);
    setStep((current) => Math.max(1, current - 1));
  };

  const handleFilePick = (file) => {
    if (!file) {
      return;
    }

    setUploadedFile(file);
    setCropFileName(file.name || "upload.jpg");
    setAiDetected(detectLikelyCategory(file.name, form.itemName));
    setIsDraftDirty(true);
    void fileToDataUrl(file)
      .then((dataUrl) => setDraftImageDataUrl(dataUrl))
      .catch(() => setDraftImageDataUrl(""));
  };

  const applyCroppedImage = (croppedFile) => {
    setUploadedFile(croppedFile);
    setAiDetected(detectLikelyCategory(croppedFile.name, form.itemName));
    setCropModalOpen(false);
    setIsDraftDirty(true);
    void fileToDataUrl(croppedFile)
      .then((dataUrl) => setDraftImageDataUrl(dataUrl))
      .catch(() => setDraftImageDataUrl(""));
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
    setDraftImageDataUrl("");
    setCropModalOpen(false);
    setIsDraftDirty(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (step !== TOTAL_STEPS) {
      return;
    }

    if (!validateStep(1) || !validateStep(2) || !validateStep(4)) {
      return;
    }

    setConfirmSubmitOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(4)) {
      setConfirmSubmitOpen(false);
      return;
    }

    if (!profile?.id) {
      setErrors((current) => ({ ...current, contactValue: current.contactValue || "You must be logged in." }));
      setConfirmSubmitOpen(false);
      return;
    }

    setConfirmSubmitOpen(false);
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

      deleteReportDraft({ reportType: "lost", userId: reportDraftUserId });
      setIsDraftDirty(false);
      navigate("/browse", {
        replace: true,
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

  const handleManualSaveDraft = () => {
    if (!hasDraftableInput) {
      return;
    }

    setIsDraftDirty(true);
    persistDraft();
    setSaveDraftNotice("Draft saved.");
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
            setDraftImageDataUrl("");
            deleteReportDraft({ reportType: "lost", userId: reportDraftUserId });
            setStep(1);
            setSubmitted(false);
            setIsDraftDirty(false);
          }}
        >
          <FontAwesomeIcon icon={faCheck} />
          Submit another report
        </button>
      </section>
    );
  }

  return (
    <>
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
                <input
                  type="text"
                  value={form.locationLost}
                  onChange={(event) => updateField("locationLost", event.target.value)}
                  placeholder="Describe where it was last seen..."
                  className="report-text-input"
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
                onChange={handleContactMethodChange}
                className="report-select"
                options={contactMethodOptions}
              />
            </label>

            <label className="report-field">
              <span>{form.contactMethod === "Email" ? "Email address" : "Phone number"}</span>
              <input
                type={isEmailContactMethod(form.contactMethod) ? "text" : "tel"}
                inputMode={isEmailContactMethod(form.contactMethod) ? "email" : "tel"}
                autoComplete={isEmailContactMethod(form.contactMethod) ? "email" : "tel"}
                value={form.contactValue}
                onChange={(event) => updateField("contactValue", event.target.value)}
                placeholder={form.contactMethod === "Email" ? "name@example.com" : "09XX XXX XXXX"}
                spellCheck={false}
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

          <div className="report-actions-right">
            <button
              type="button"
              className="report-secondary-button"
              onClick={handleManualSaveDraft}
              disabled={!hasDraftableInput || isSubmitting}
            >
              Save as draft
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
        </div>
        {saveDraftNotice ? <p className="report-draft-inline-note">{saveDraftNotice}</p> : null}
        {!saveDraftNotice && !hasDraftableInput ? (
          <p className="report-draft-inline-note report-draft-inline-note-muted">
            Enter at least one detail to enable draft save.
          </p>
        ) : null}
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

      <Modal
        isOpen={Boolean(draftRestoreData) && draftRestoreOpen}
        onClose={() => {
          setDraftRestoreOpen(false);
          setDraftRestoreData(null);
          deleteReportDraft({ reportType: "lost", userId: reportDraftUserId });
          setIsDraftDirty(false);
        }}
        ariaLabel="Restore report draft"
        overlayClassName="report-draft-backdrop"
        panelClassName="report-draft-modal"
      >
        <p className="report-draft-kicker">Unsaved draft found</p>
        <h3>Want to restore your draft?</h3>
        <p className="report-draft-copy">
          We found a saved lost-item report from your last session. You can restore it and continue where you left off, or start fresh.
        </p>
        <div className="report-draft-actions">
          <button
            type="button"
            className="report-secondary-button"
            onClick={() => {
              setDraftRestoreOpen(false);
              setDraftRestoreData(null);
              setForm(emptyForm);
              setErrors({});
              setUploadedFile(null);
              setDraftImageDataUrl("");
              setAiDetected("");
              setStep(1);
              deleteReportDraft({ reportType: "lost", userId: reportDraftUserId });
              setIsDraftDirty(false);
            }}
          >
            Start fresh
          </button>
          <button
            type="button"
            className="report-primary-button"
            onClick={() => {
              setDraftRestoreOpen(false);
            }}
          >
            Restore draft
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={confirmSubmitOpen && step === TOTAL_STEPS}
        onClose={() => setConfirmSubmitOpen(false)}
        ariaLabel="Confirm report submission"
        overlayClassName="report-draft-backdrop"
        panelClassName="report-draft-modal"
      >
        <p className="report-draft-kicker">Final check</p>
        <h3>Are you sure you want to submit this report?</h3>
        <p className="report-draft-copy">
          Your lost-item report will be uploaded and reviewed for matching. Please verify all details are accurate before continuing.
        </p>
        <div className="report-draft-actions">
          <button
            type="button"
            className="report-secondary-button"
            onClick={() => setConfirmSubmitOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="report-primary-button"
            onClick={handleConfirmSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Uploading..." : "Yes, upload report"}
          </button>
        </div>
      </Modal>
    </>
  );
};

export default ReportLostItem;
