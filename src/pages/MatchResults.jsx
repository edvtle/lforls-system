import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudArrowUp,
  faFilter,
  faImage,
  faMagnifyingGlass,
  faRobot,
  faShieldHalved,
  faToggleOn,
  faTriangleExclamation,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import MatchCard from "../components/MatchCard";
import SelectDropdown from "../components/ui/SelectDropdown";
import { homeItems } from "../data/items";
import { rankFoundMatches } from "../utils/matching";
import "../styles/MatchResults.css";

const HIGH_CONFIDENCE_THRESHOLD = 80;

const keywordCategoryMap = [
  { keyword: "wallet", category: "Accessories" },
  { keyword: "bag", category: "Bags" },
  { keyword: "backpack", category: "Bags" },
  { keyword: "phone", category: "Electronics" },
  { keyword: "iphone", category: "Electronics" },
  { keyword: "headphone", category: "Electronics" },
  { keyword: "key", category: "Keys" },
  { keyword: "id", category: "ID Cards" },
  { keyword: "card", category: "Documents" },
  { keyword: "bottle", category: "Personal" },
];

const detectLikelyCategory = (fileName = "") => {
  const normalized = fileName.toLowerCase();
  const found = keywordCategoryMap.find((entry) => normalized.includes(entry.keyword));
  return found?.category || "Personal";
};

const detectLikelyColor = (fileName = "") => {
  const normalized = fileName.toLowerCase();
  const colorKeywords = ["black", "white", "blue", "red", "green", "silver", "gray", "pink", "brown"];
  const match = colorKeywords.find((color) => normalized.includes(color));
  return match || "Unknown";
};

const detectedLabelByCategory = {
  Accessories: "Wallet",
  Bags: "Bag",
  Electronics: "Electronic Device",
  Keys: "Keys",
  "ID Cards": "ID Card",
  Documents: "Document",
  Personal: "Personal Item",
};

const toLostReport = (item) => ({
  itemName: item.name,
  category: item.category,
  locationLost: item.location,
  dateLost: item.date,
  description: item.description,
  identifiers: item.serialNumber || "",
  color: item.color || "",
  hasImage: Boolean(item.image),
});

const truncateFileName = (fileName = "", maxLength = 32) => {
  if (!fileName || fileName.length <= maxLength) {
    return fileName;
  }

  return `${fileName.slice(0, Math.max(1, maxLength - 3))}...`;
};

const MatchResults = () => {
  const fileInputRef = useRef(null);
  const [selectedLostItemId, setSelectedLostItemId] = useState("");
  const [controlTab, setControlTab] = useState("select");
  const [matchMode, setMatchMode] = useState("high");
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [aiDetection, setAiDetection] = useState(null);

  const lostItems = useMemo(() => homeItems.filter((item) => item.status === "Lost"), []);

  const selectedLostItem = useMemo(
    () => lostItems.find((item) => item.id === selectedLostItemId) || null,
    [lostItems, selectedLostItemId],
  );

  useEffect(() => {
    if (!selectedLostItemId && lostItems.length) {
      setSelectedLostItemId(lostItems[0].id);
    }
  }, [lostItems, selectedLostItemId]);

  useEffect(() => {
    if (!uploadedFile) {
      setImagePreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(uploadedFile);
    setImagePreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [uploadedFile]);

  const dropdownLostReport = useMemo(() => {
    if (!selectedLostItem) {
      return null;
    }

    return toLostReport(selectedLostItem);
  }, [selectedLostItem]);

  const quickImageLostReport = useMemo(() => {
    if (!aiDetection) {
      return null;
    }

    return {
      itemName: aiDetection.detectedLabel,
      category: aiDetection.category,
      locationLost: "Unknown",
      dateLost: new Date().toISOString().slice(0, 10),
      description: `AI detected probable ${aiDetection.detectedLabel.toLowerCase()} from uploaded image.`,
      identifiers: uploadedFile?.name || "",
      color: aiDetection.color,
      hasImage: true,
    };
  }, [aiDetection, uploadedFile]);

  const activeLostReport = controlTab === "upload" && quickImageLostReport ? quickImageLostReport : dropdownLostReport;
  const activeSource = controlTab === "upload" && quickImageLostReport ? "image" : "report";

  const allMatches = useMemo(() => rankFoundMatches(activeLostReport, homeItems, 20), [activeLostReport]);

  const visibleMatches = useMemo(() => {
    if (matchMode === "all") {
      return allMatches;
    }

    return allMatches.filter((item) => item.match.score >= HIGH_CONFIDENCE_THRESHOLD);
  }, [allMatches, matchMode]);

  const handleFilePick = (file) => {
    if (!file) {
      return;
    }

    const category = detectLikelyCategory(file.name);
    const color = detectLikelyColor(file.name);
    const detectedLabel = detectedLabelByCategory[category] || "Item";
    const confidence = Math.min(97, 82 + Math.floor(Math.random() * 14));

    setUploadedFile(file);
    setControlTab("upload");
    setAiDetection({
      category,
      color,
      detectedLabel,
      confidence,
    });
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    handleFilePick(event.dataTransfer.files?.[0]);
  };

  const resetQuickMatch = () => {
    setUploadedFile(null);
    setAiDetection(null);
    setControlTab("select");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const highCount = allMatches.filter((item) => item.match.score >= HIGH_CONFIDENCE_THRESHOLD).length;

  const lostItemOptions = useMemo(
    () => [
      { value: "", label: "Select your lost item" },
      ...lostItems.map((item) => ({
        value: item.id,
        label: `${item.name} (Lost - ${item.location})`,
      })),
    ],
    [lostItems],
  );

  const sectionTitle = matchMode === "high" ? "High-confidence matches (80%+)" : "All ranked matches";
  const shortUploadedName = truncateFileName(uploadedFile?.name || "", 32);

  return (
    <section className="match-results-page">
      <section className="page-card match-smart-hero">
        <div className="match-hero-content">
          <p className="page-kicker">Smart match system</p>
          <h2 className="page-title">Find your item faster</h2>
          <p className="page-description match-hero-description-single-line">
            Select an existing lost report or upload an image for quick match. Results prioritize high-confidence matches to reduce manual searching.
          </p>
        </div>
      </section>

      <section className="page-card match-workspace" aria-label="Smart match workspace">
        <div className="match-workspace-top">
          <div className="match-toggle-group" role="radiogroup" aria-label="Match quality filter">
            <button
              type="button"
              className={`match-toggle-button ${matchMode === "high" ? "match-toggle-button-active" : ""}`}
              onClick={() => setMatchMode("high")}
            >
              <FontAwesomeIcon icon={faToggleOn} /> High matches (80%+)
            </button>
            <button
              type="button"
              className={`match-toggle-button ${matchMode === "all" ? "match-toggle-button-active" : ""}`}
              onClick={() => setMatchMode("all")}
            >
              <FontAwesomeIcon icon={faFilter} /> All matches
            </button>
          </div>

          <p className="match-high-note">Showing high-confidence matches (80%+) by default</p>

          <div className="match-result-meta">
            <strong>{highCount}</strong>
            <span>high-confidence candidates found</span>
          </div>
        </div>

        <div className="match-workspace-grid">
          <aside className="match-control-panel" aria-label="Matching controls">
            <div className="match-control-tabs" role="tablist" aria-label="Input mode">
              <button
                type="button"
                role="tab"
                aria-selected={controlTab === "select"}
                className={`match-control-tab ${controlTab === "select" ? "match-control-tab-active" : ""}`}
                onClick={() => setControlTab("select")}
              >
                Select
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={controlTab === "upload"}
                className={`match-control-tab ${controlTab === "upload" ? "match-control-tab-active" : ""}`}
                onClick={() => setControlTab("upload")}
              >
                Upload
              </button>
            </div>

            {controlTab === "select" ? (
              <div className="match-flow-block match-flow-block-select">
                <p className="page-kicker">Select your lost item</p>
                <SelectDropdown
                  value={selectedLostItemId}
                  onChange={(value) => {
                    setSelectedLostItemId(value);
                    if (value) {
                      setControlTab("select");
                    }
                  }}
                  className="match-smart-select"
                  options={lostItemOptions}
                />
                <p className="match-flow-helper">
                  <FontAwesomeIcon icon={faMagnifyingGlass} /> System auto-fetches item details and runs matching.
                </p>
              </div>
            ) : (
              <div className="match-flow-block match-flow-block-upload">
                <p className="page-kicker">Upload image (Quick match)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="report-hidden-input"
                  onChange={(event) => handleFilePick(event.target.files?.[0])}
                />

                <button
                  type="button"
                  className={`match-upload-zone ${dragActive ? "match-upload-zone-active" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <FontAwesomeIcon icon={faCloudArrowUp} />
                  <strong>Upload image to find matches</strong>
                  <span>Drag and drop or click to browse</span>
                </button>

                {imagePreview ? (
                  <div className="match-image-preview">
                    <img src={imagePreview} alt="Quick match upload preview" />
                    <div>
                      <p className="match-image-name" title={uploadedFile?.name || ""}>
                        <FontAwesomeIcon icon={faImage} />
                        <span className="match-image-name-text">{shortUploadedName}</span>
                      </p>
                      <button type="button" className="match-inline-button" onClick={resetQuickMatch}>
                        Use report instead
                      </button>
                    </div>
                  </div>
                ) : null}

                {aiDetection ? (
                  <div className="match-ai-detection">
                    <p>
                      <FontAwesomeIcon icon={faWandMagicSparkles} /> Detected: <strong>{aiDetection.detectedLabel}</strong>
                    </p>
                    <p>
                      <FontAwesomeIcon icon={faFilter} /> Features: <strong>{aiDetection.category}</strong> | <strong>{aiDetection.color}</strong>
                    </p>
                    <p>
                      <FontAwesomeIcon icon={faRobot} /> AI confidence: <strong>{aiDetection.confidence}%</strong>
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </aside>

          <section className="match-results-board">
            <div className="match-section-head">
              <h3>{sectionTitle}</h3>
              <p>{activeSource === "image" ? "Powered by quick image analysis" : "Based on selected lost report"}</p>
            </div>

            {visibleMatches.length ? (
              <div className="match-card-list" role="list">
                {visibleMatches.map((item) => (
                  <MatchCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="match-empty-state" role="status">
                <h4>
                  <FontAwesomeIcon icon={faTriangleExclamation} /> No high-confidence matches found
                </h4>
                <p>Try uploading another image or report your item with more details for better results.</p>
              </div>
            )}
          </section>
        </div>
      </section>

      <section className="page-card match-safety-reminder">
        <p>
          <FontAwesomeIcon icon={faShieldHalved} /> Safety reminder: High match scores still require claimant verification and admin approval.
        </p>
        <ul>
          <li>Verify unique marks or serial details before release.</li>
          <li>Keep communication in-app until ownership is confirmed.</li>
          <li>Escalate suspicious claims for admin review.</li>
        </ul>
      </section>
    </section>
  );
};

export default MatchResults;
