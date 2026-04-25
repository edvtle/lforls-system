import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useAuth } from "../context/AuthContext";
import { listRecentItems } from "../services/itemsService";
import { rankFoundMatches } from "../utils/matching";
import "../styles/MatchResults.css";

const HIGH_CONFIDENCE_THRESHOLD = 80;

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

const normalize = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const words = (value = "") => normalize(value).split(" ").filter(Boolean);

const getFileLabel = (fileName = "") => {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const label = words(withoutExtension).join(" ");
  return label || "Uploaded item";
};

const detectCategoryFromDatabase = (fileName = "", items = []) => {
  const tokens = words(fileName);
  if (!tokens.length) {
    return "";
  }

  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))];
  return (
    categories.find((category) => {
      const categoryTokens = words(category);
      return categoryTokens.some((token) => tokens.includes(token));
    }) || ""
  );
};

const classifyColor = ({ r, g, b }) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (max < 55) return "black";
  if (min > 205 && delta < 35) return "white";
  if (delta < 25) return "gray";
  if (r > 150 && g > 105 && b < 90) return "brown";
  if (r >= g && r >= b) return r - b > 50 && g < 120 ? "red" : "pink";
  if (g >= r && g >= b) return "green";
  if (b >= r && b >= g) return "blue";
  return "unknown";
};

const analyzeImageColor = (file) =>
  new Promise((resolve) => {
    if (!file) {
      resolve("unknown");
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const size = 48;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        resolve("unknown");
        return;
      }

      context.drawImage(image, 0, 0, size, size);
      const pixels = context.getImageData(0, 0, size, size).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3];
        if (alpha < 80) {
          continue;
        }

        r += pixels[index];
        g += pixels[index + 1];
        b += pixels[index + 2];
        count += 1;
      }

      URL.revokeObjectURL(objectUrl);
      if (!count) {
        resolve("unknown");
        return;
      }

      resolve(
        classifyColor({
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count),
        }),
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve("unknown");
    };

    image.src = objectUrl;
  });

const truncateFileName = (fileName = "", maxLength = 32) => {
  if (!fileName || fileName.length <= maxLength) {
    return fileName;
  }

  return `${fileName.slice(0, Math.max(1, maxLength - 3))}...`;
};

const MatchResults = () => {
  const fileInputRef = useRef(null);
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedLostItemId, setSelectedLostItemId] = useState("");
  const [controlTab, setControlTab] = useState("select");
  const [matchMode, setMatchMode] = useState(() => (searchParams.get("mode") === "high" ? "high" : "all"));
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [aiDetection, setAiDetection] = useState(null);
  const [marketplaceItems, setMarketplaceItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadItems = async () => {
      setIsLoadingItems(true);
      setLoadError("");

      try {
        const items = await listRecentItems({ limit: 250 });
        if (!mounted) {
          return;
        }

        setMarketplaceItems(items);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setMarketplaceItems([]);
        setLoadError(error?.message || "Unable to load database items for matching.");
      } finally {
        if (mounted) {
          setIsLoadingItems(false);
        }
      }
    };

    loadItems();

    return () => {
      mounted = false;
    };
  }, []);

  const currentUserId = session?.user?.id || "";

  const lostItems = useMemo(
    () =>
      marketplaceItems.filter(
        (item) => item.status === "Lost" && (!currentUserId || item.reporterId === currentUserId),
      ),
    [marketplaceItems, currentUserId],
  );

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
      category: aiDetection.category || "",
      locationLost: "Unknown",
      dateLost: "",
      description: `Image scan detected ${aiDetection.detectedLabel.toLowerCase()} with dominant ${aiDetection.color} color.`,
      identifiers: uploadedFile?.name || "",
      color: aiDetection.color,
      hasImage: true,
    };
  }, [aiDetection, uploadedFile]);

  const activeLostReport = controlTab === "upload" && quickImageLostReport ? quickImageLostReport : dropdownLostReport;
  const activeSource = controlTab === "upload" && quickImageLostReport ? "image" : "report";

  const allMatches = useMemo(() => rankFoundMatches(activeLostReport, marketplaceItems, 20), [activeLostReport, marketplaceItems]);

  const visibleMatches = useMemo(() => {
    if (matchMode === "all") {
      return allMatches;
    }

    return allMatches.filter((item) => item.match.score >= HIGH_CONFIDENCE_THRESHOLD);
  }, [allMatches, matchMode]);

  const handleFilePick = async (file) => {
    if (!file) {
      return;
    }

    setUploadedFile(file);
    setControlTab("upload");
    setAiDetection(null);

    const category = detectCategoryFromDatabase(file.name, marketplaceItems);
    const color = await analyzeImageColor(file);
    const detectedLabel = getFileLabel(file.name);
    const matchingSignals = [category, color !== "unknown", detectedLabel !== "Uploaded item"].filter(Boolean).length;

    setAiDetection({
      category,
      color,
      detectedLabel,
      confidence: Math.round((matchingSignals / 3) * 100),
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
  const relevantCount = allMatches.length;

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

  const sectionTitle = matchMode === "high" ? "High-confidence matches (80%+)" : "Relevant database matches";
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

          <p className="match-high-note">Showing database posts with real similarity signals</p>

          <div className="match-result-meta">
            <strong>{matchMode === "high" ? highCount : relevantCount}</strong>
            <span>{matchMode === "high" ? "high-confidence candidates" : "relevant candidates"} found</span>
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
                      <FontAwesomeIcon icon={faWandMagicSparkles} /> Image scan: <strong>{aiDetection.detectedLabel}</strong>
                    </p>
                    <p>
                      <FontAwesomeIcon icon={faFilter} /> Signals: <strong>{aiDetection.category || "Database category not detected"}</strong> | <strong>{aiDetection.color}</strong>
                    </p>
                    <p>
                      <FontAwesomeIcon icon={faRobot} /> Match signal coverage: <strong>{aiDetection.confidence}%</strong>
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </aside>

          <section className="match-results-board">
            <div className="match-section-head">
              <h3>{sectionTitle}</h3>
              <p>{activeSource === "image" ? "Based on image color and database item details" : "Based on selected lost report details"}</p>
            </div>

            {isLoadingItems ? (
              <div className="match-empty-state" role="status">
                <h4>Loading database items...</h4>
                <p>Fetching lost and found reports before running the matcher.</p>
              </div>
            ) : loadError ? (
              <div className="match-empty-state" role="status">
                <h4>
                  <FontAwesomeIcon icon={faTriangleExclamation} /> Unable to load matches
                </h4>
                <p>{loadError}</p>
              </div>
            ) : visibleMatches.length ? (
              <div className="match-card-list" role="list">
                {visibleMatches.map((item) => (
                  <MatchCard key={item.id} item={item} matchMode={matchMode} />
                ))}
              </div>
            ) : matchMode === "high" && allMatches.length ? (
              <div className="match-empty-state match-empty-state-action" role="status">
                <h4>
                  <FontAwesomeIcon icon={faTriangleExclamation} /> No matches above 80%
                </h4>
                <p>There's no match more than 80%. Wanna check All Items?</p>
                <button type="button" className="match-inline-button" onClick={() => setMatchMode("all")}>
                  All Items
                </button>
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
        <div className="match-safety-icon">
          <FontAwesomeIcon icon={faShieldHalved} />
        </div>
        <div className="match-safety-content">
          <p>
            <span>Safety reminder</span>
            <strong>High match scores still require claimant verification and admin approval.</strong>
          </p>
          <ul>
            <li>Verify unique marks or serial details before release.</li>
            <li>Keep communication in-app until ownership is confirmed.</li>
            <li>Escalate suspicious claims for admin review.</li>
          </ul>
        </div>
      </section>
    </section>
  );
};

export default MatchResults;
