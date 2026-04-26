import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronDown,
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
  brand: item.brand || "",
  paletteColors: item.color ? [item.color] : [],
  scanQuality: 0,
  hasImage: Boolean(item.image),
});

const normalize = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const words = (value = "") => normalize(value).split(" ").filter(Boolean);

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const getFileLabel = (fileName = "") => {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const label = words(withoutExtension).join(" ");
  return label || "Uploaded item";
};

const looksLikeGenericCameraName = (fileName = "") => {
  const raw = (fileName || "").replace(/\.[^.]+$/, "");
  const value = normalize(raw);
  if (!value) {
    return true;
  }

  if (/^(img|image|photo|dsc|screenshot|scan)\s*\d+$/.test(value)) {
    return true;
  }

  if (/^p\d{6,}$/.test(value)) {
    return true;
  }

  return false;
};

const inferLabelFromFoundItems = ({
  items = [],
  category = "",
  dominantColor = "",
  paletteColors = [],
}) => {
  const targetColorTokens = new Set(words(`${dominantColor} ${paletteColors.join(" ")}`));
  const stopWords = new Set([
    "item",
    "lost",
    "found",
    "the",
    "and",
    "for",
    "with",
    "from",
    "black",
    "white",
    "gray",
    "grey",
    "blue",
    "green",
    "red",
    "brown",
    "yellow",
    "orange",
    "pink",
    "purple",
  ]);

  const candidates = items
    .filter((item) => item.status === "Found")
    .map((item) => {
      const itemColorTokens = new Set(words(`${item.color || ""} ${item.description || ""}`));
      const colorOverlap = [...targetColorTokens].filter((token) => itemColorTokens.has(token)).length;
      const colorScore = targetColorTokens.size
        ? colorOverlap / Math.max(1, targetColorTokens.size)
        : 0;
      const categoryScore = category && item.category && normalize(category) === normalize(item.category) ? 1 : 0;
      const score = categoryScore * 2 + colorScore * 1.5;

      return {
        item,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 25);

  if (!candidates.length) {
    return "";
  }

  const tokenWeights = new Map();
  candidates.forEach(({ item, score }) => {
    words(item.name)
      .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !stopWords.has(token))
      .forEach((token) => {
        tokenWeights.set(token, (tokenWeights.get(token) || 0) + score);
      });
  });

  const bestTokens = [...tokenWeights.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([token]) => token);

  if (!bestTokens.length) {
    return "";
  }

  return bestTokens.join(" ");
};

const detectCategoryFromDatabase = ({ fileName = "", label = "", dominantColor = "", paletteColors = [], items = [] }) => {
  const tokens = [...words(fileName), ...words(label)];
  const colorTokens = [dominantColor, ...paletteColors].flatMap((entry) => words(entry));
  const combinedTokens = [...tokens, ...colorTokens];
  if (!combinedTokens.length) {
    return "";
  }

  const categoryScores = new Map();

  items
    .filter((item) => item.status === "Found")
    .forEach((item) => {
      const category = item.category || "";
      if (!category) {
        return;
      }

      const contextTokens = words(`${item.category} ${item.name} ${item.description} ${item.color}`);
      const score = combinedTokens.reduce((total, token) => {
        if (!contextTokens.includes(token)) {
          return total;
        }

        if (colorTokens.includes(token)) {
          return total + 1.2;
        }

        return total + 1;
      }, 0);

      if (score > 0) {
        categoryScores.set(category, (categoryScores.get(category) || 0) + score);
      }
    });

  let bestCategory = "";
  let bestScore = 0;
  categoryScores.forEach((score, category) => {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  });

  return bestCategory;
};

const classifyColor = ({ r, g, b }) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (max < 55) return "black";
  if (min > 205 && delta < 35) return "white";
  if (delta < 25) return "gray";
  if (r > 170 && g > 140 && b < 85) return "yellow";
  if (r > 180 && g > 95 && b < 75) return "orange";
  if (r > 120 && b > 120 && g < 120) return "purple";
  if (r > 150 && g > 105 && b < 90) return "brown";
  if (r >= g && r >= b) return r - b > 50 && g < 120 ? "red" : "pink";
  if (g >= r && g >= b) return "green";
  if (b >= r && b >= g) return "blue";
  return "unknown";
};

const analyzeImageScan = (file) =>
  new Promise((resolve) => {
    if (!file) {
      resolve({
        dominantColor: "unknown",
        paletteColors: [],
        qualityScore: 0,
        qualityHints: ["Upload an image to scan."],
      });
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        resolve({
          dominantColor: "unknown",
          paletteColors: [],
          qualityScore: 0,
          qualityHints: ["Unable to scan this image in your browser."],
        });
        return;
      }

      context.drawImage(image, 0, 0, size, size);
      const pixels = context.getImageData(0, 0, size, size).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      const colorBins = new Map();
      const luminance = new Float32Array(size * size);
      let lumSum = 0;
      let lumSqSum = 0;
      let pixelIndex = 0;

      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3];
        if (alpha < 80) {
          luminance[pixelIndex] = 0;
          pixelIndex += 1;
          continue;
        }

        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];

        r += red;
        g += green;
        b += blue;
        count += 1;

        const lum = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        luminance[pixelIndex] = lum;
        lumSum += lum;
        lumSqSum += lum * lum;

        const binKey = `${Math.floor(red / 32)}-${Math.floor(green / 32)}-${Math.floor(blue / 32)}`;
        const currentBin = colorBins.get(binKey) || { count: 0, r: 0, g: 0, b: 0 };
        colorBins.set(binKey, {
          count: currentBin.count + 1,
          r: currentBin.r + red,
          g: currentBin.g + green,
          b: currentBin.b + blue,
        });
        pixelIndex += 1;
      }

      URL.revokeObjectURL(objectUrl);
      if (!count) {
        resolve({
          dominantColor: "unknown",
          paletteColors: [],
          qualityScore: 0,
          qualityHints: ["Image appears empty or fully transparent."],
        });
        return;
      }

      const avgColor = {
        r: Math.round(r / count),
        g: Math.round(g / count),
        b: Math.round(b / count),
      };

      const paletteColors = [...colorBins.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, 3)
        .map((entry) =>
          classifyColor({
            r: Math.round(entry.r / entry.count),
            g: Math.round(entry.g / entry.count),
            b: Math.round(entry.b / entry.count),
          }),
        )
        .filter((color) => color && color !== "unknown")
        .filter((color, index, list) => list.indexOf(color) === index);

      const meanLum = lumSum / count;
      const variance = Math.max(0, lumSqSum / count - meanLum * meanLum);
      const contrast = Math.sqrt(variance);

      let gradientSum = 0;
      let gradientCount = 0;
      for (let y = 0; y < size - 1; y += 1) {
        for (let x = 0; x < size - 1; x += 1) {
          const idx = y * size + x;
          const dx = Math.abs(luminance[idx + 1] - luminance[idx]);
          const dy = Math.abs(luminance[idx + size] - luminance[idx]);
          gradientSum += dx + dy;
          gradientCount += 1;
        }
      }

      const sharpness = gradientCount ? gradientSum / gradientCount : 0;
      const exposureScore = 1 - Math.min(1, Math.abs(meanLum - 128) / 128);
      const contrastScore = clamp(contrast / 60);
      const sharpnessScore = clamp(sharpness / 30);
      const qualityScore = Math.round(
        clamp(exposureScore * 0.35 + contrastScore * 0.3 + sharpnessScore * 0.35) * 100,
      );

      const qualityHints = [];
      if (sharpnessScore < 0.28) {
        qualityHints.push("Image looks blurry. Move closer and retake if possible.");
      }
      if (contrastScore < 0.25) {
        qualityHints.push("Low contrast detected. Use better lighting or plain background.");
      }
      if (exposureScore < 0.3) {
        qualityHints.push("Exposure is too dark or too bright. Adjust lighting for cleaner scanning.");
      }

      resolve(
        {
          dominantColor: classifyColor(avgColor),
          paletteColors,
          qualityScore,
          qualityHints,
        },
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        dominantColor: "unknown",
        paletteColors: [],
        qualityScore: 0,
        qualityHints: ["Image scan failed. Try another file."],
      });
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
  const lostPickerRef = useRef(null);
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedLostItemId, setSelectedLostItemId] = useState("");
  const [isLostPickerOpen, setIsLostPickerOpen] = useState(false);
  const [controlTab, setControlTab] = useState("select");
  const [matchMode, setMatchMode] = useState(() => (searchParams.get("mode") === "high" ? "high" : "all"));
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [aiDetection, setAiDetection] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [marketplaceItems, setMarketplaceItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [loadError, setLoadError] = useState("");
  const latestScanIdRef = useRef(0);

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
    if (selectedLostItemId && !lostItems.some((item) => item.id === selectedLostItemId)) {
      setSelectedLostItemId("");
    }
  }, [lostItems, selectedLostItemId]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!lostPickerRef.current?.contains(event.target)) {
        setIsLostPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

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
      description: `Image scan detected ${aiDetection.detectedLabel.toLowerCase()} with dominant ${aiDetection.color} color and ${aiDetection.scanQuality}% scan quality.`,
      identifiers: looksLikeGenericCameraName(uploadedFile?.name || "") ? "" : uploadedFile?.name || "",
      color: aiDetection.color,
      paletteColors: aiDetection.paletteColors || [],
      brand: "",
      scanQuality: aiDetection.scanQuality || 0,
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

    const scanId = Date.now();
    latestScanIdRef.current = scanId;

    setUploadedFile(file);
    setControlTab("upload");
    setAiDetection(null);
    setIsScanning(true);

    const scan = await analyzeImageScan(file);

    if (latestScanIdRef.current !== scanId) {
      return;
    }

    const rawLabel = getFileLabel(file.name);
    const detectedLabel = looksLikeGenericCameraName(file.name) ? "Uploaded item" : rawLabel;
    const category = detectCategoryFromDatabase({
      fileName: file.name,
      label: detectedLabel,
      dominantColor: scan.dominantColor,
      paletteColors: scan.paletteColors || [],
      items: marketplaceItems,
    });
    const inferredCorpusLabel = inferLabelFromFoundItems({
      items: marketplaceItems,
      category,
      dominantColor: scan.dominantColor,
      paletteColors: scan.paletteColors || [],
    });
    const normalizedLabel =
      detectedLabel === "Uploaded item" && category
        ? inferredCorpusLabel || `${category} item`
        : detectedLabel === "Uploaded item"
          ? inferredCorpusLabel || detectedLabel
        : detectedLabel;
    const matchingSignals = [
      category,
      scan.dominantColor !== "unknown",
      normalizedLabel !== "Uploaded item",
      (scan.paletteColors || []).length > 1,
      Number(scan.qualityScore || 0) >= 55,
    ].filter(Boolean).length;

    setAiDetection({
      category,
      color: scan.dominantColor,
      paletteColors: scan.paletteColors || [],
      detectedLabel: normalizedLabel,
      scanQuality: Number(scan.qualityScore || 0),
      qualityHints: scan.qualityHints || [],
      confidence: Math.round((matchingSignals / 5) * 100),
    });
    setIsScanning(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    handleFilePick(event.dataTransfer.files?.[0]);
  };

  const resetQuickMatch = () => {
    latestScanIdRef.current += 1;
    setUploadedFile(null);
    setAiDetection(null);
    setIsScanning(false);
    setControlTab("select");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const highCount = allMatches.filter((item) => item.match.score >= HIGH_CONFIDENCE_THRESHOLD).length;
  const relevantCount = allMatches.length;

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
                <div
                  ref={lostPickerRef}
                  className={`match-lost-picker ${isLostPickerOpen ? "match-lost-picker-open" : ""}`}
                >
                  <button
                    type="button"
                    className="match-lost-picker-button"
                    aria-haspopup="listbox"
                    aria-expanded={isLostPickerOpen}
                    onClick={() => setIsLostPickerOpen((isOpen) => !isOpen)}
                  >
                    <span className={selectedLostItem ? "match-lost-picker-value" : "match-lost-picker-placeholder"}>
                      {selectedLostItem ? selectedLostItem.name : "Select your lost item"}
                    </span>
                    {selectedLostItem ? (
                      <span className="match-lost-picker-meta">{selectedLostItem.category} | {selectedLostItem.location}</span>
                    ) : null}
                    <FontAwesomeIcon icon={faChevronDown} className="match-lost-picker-chevron" />
                  </button>

                  {isLostPickerOpen ? (
                    <div className="match-lost-picker-menu" role="listbox" aria-label="Lost item choices">
                      {lostItems.length ? (
                        lostItems.map((item) => {
                          const isSelected = item.id === selectedLostItemId;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              className={`match-lost-picker-option ${isSelected ? "match-lost-picker-option-selected" : ""}`}
                              onClick={() => {
                                setSelectedLostItemId(item.id);
                                setControlTab("select");
                                setIsLostPickerOpen(false);
                              }}
                            >
                              <span className="match-lost-picker-option-main">
                                <strong>{item.name}</strong>
                                <small>{item.category} | Lost at {item.location}</small>
                              </span>
                              {isSelected ? <FontAwesomeIcon icon={faCheck} /> : null}
                            </button>
                          );
                        })
                      ) : (
                        <p className="match-lost-picker-empty">No lost reports available</p>
                      )}
                    </div>
                  ) : null}
                </div>
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
                    <div className="match-ai-detection-head">
                      <span className="match-ai-detection-icon">
                        <FontAwesomeIcon icon={faWandMagicSparkles} />
                      </span>
                      <div>
                        <span>Image scan</span>
                        <strong>{aiDetection.detectedLabel}</strong>
                      </div>
                    </div>

                    <div className="match-ai-stats" aria-label="Image scan scores">
                      <div>
                        <span>Match signal</span>
                        <strong>{aiDetection.confidence}%</strong>
                      </div>
                      <div>
                        <span>Scan quality</span>
                        <strong>{aiDetection.scanQuality}%</strong>
                      </div>
                    </div>

                    <div className="match-ai-signal-list">
                      <span>
                        <FontAwesomeIcon icon={faFilter} /> {aiDetection.category || "Category not detected"}
                      </span>
                      <span>{aiDetection.color}</span>
                      {aiDetection.paletteColors?.length ? <span>{aiDetection.paletteColors.join(", ")}</span> : null}
                    </div>

                    {aiDetection.qualityHints?.length ? (
                      <p className="match-ai-hint">{aiDetection.qualityHints[0]}</p>
                    ) : null}
                  </div>
                ) : null}

                {isScanning ? (
                  <div className="match-ai-detection match-ai-detection-loading">
                    <p className="match-ai-hint">
                      <FontAwesomeIcon icon={faRobot} /> Scanning image for quality and visual cues...
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
