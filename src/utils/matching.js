const WEIGHTS = {
  category: 20,
  name: 20,
  location: 12,
  date: 8,
  description: 15,
  identifier: 10,
  brand: 7,
  image: 8,
};

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce(
  (sum, value) => sum + value,
  0,
);

const CATEGORY_ALIASES = {
  electronics: "electronics",
  gadget: "electronics",
  gadgets: "electronics",
  wallet: "wallet",
  purse: "wallet",
  bag: "bag",
  backpack: "bag",
  tote: "bag",
  id: "id",
  "id card": "id",
  card: "id",
  clothing: "clothing",
  clothes: "clothing",
  jacket: "clothing",
  shirt: "clothing",
};

const COLOR_GROUPS = {
  black: ["black", "charcoal", "jet"],
  white: ["white", "ivory", "cream"],
  gray: ["gray", "grey", "silver", "slate"],
  blue: ["blue", "navy", "azure", "teal"],
  green: ["green", "olive", "lime", "mint"],
  red: ["red", "maroon", "crimson", "burgundy"],
  pink: ["pink", "rose", "fuchsia"],
  yellow: ["yellow", "gold", "mustard"],
  orange: ["orange", "amber", "coral"],
  brown: ["brown", "tan", "beige", "khaki"],
  purple: ["purple", "violet", "lavender"],
};

const normalize = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const words = (value = "") =>
  new Set(normalize(value).split(" ").filter(Boolean));

const wordArray = (value = "") => normalize(value).split(" ").filter(Boolean);

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const toCanonicalCategory = (value = "") => {
  const normalized = normalize(value);
  return CATEGORY_ALIASES[normalized] || normalized;
};

const collectCanonicalColors = (...values) => {
  const tokens = values.flatMap((value) => wordArray(value));
  const resolved = new Set();

  tokens.forEach((token) => {
    const groupEntry = Object.entries(COLOR_GROUPS).find(([, aliases]) =>
      aliases.includes(token),
    );
    if (groupEntry) {
      resolved.add(groupEntry[0]);
    }
  });

  return resolved;
};

const colorSimilarity = (lostReport, foundItem) => {
  const lostColors = collectCanonicalColors(
    lostReport.color,
    ...(lostReport.paletteColors || []),
  );
  const foundColors = collectCanonicalColors(
    foundItem.color,
    foundItem.description,
  );

  if (!lostColors.size || !foundColors.size) {
    return 0;
  }

  const overlap = [...lostColors].filter((token) =>
    foundColors.has(token),
  ).length;
  return overlap / Math.max(lostColors.size, foundColors.size);
};

const dateGapDays = (lostDate, foundDate) => {
  if (!lostDate || !foundDate) {
    return null;
  }

  const lost = new Date(`${lostDate}T00:00:00`).getTime();
  const found = new Date(`${foundDate}T00:00:00`).getTime();

  if (Number.isNaN(lost) || Number.isNaN(found)) {
    return null;
  }

  return Math.abs(lost - found) / (1000 * 60 * 60 * 24);
};

const bigramSimilarity = (left = "", right = "") => {
  const a = normalize(left);
  const b = normalize(right);

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const toBigrams = (input) => {
    if (input.length < 2) {
      return [input];
    }

    const grams = [];
    for (let index = 0; index < input.length - 1; index += 1) {
      grams.push(input.slice(index, index + 2));
    }
    return grams;
  };

  const leftGrams = toBigrams(a);
  const rightGrams = toBigrams(b);
  const rightCounts = new Map();

  rightGrams.forEach((gram) => {
    rightCounts.set(gram, (rightCounts.get(gram) || 0) + 1);
  });

  let intersection = 0;
  leftGrams.forEach((gram) => {
    const count = rightCounts.get(gram) || 0;
    if (count > 0) {
      intersection += 1;
      rightCounts.set(gram, count - 1);
    }
  });

  return (2 * intersection) / (leftGrams.length + rightGrams.length);
};

const jaccardSimilarity = (left = "", right = "") => {
  const a = words(left);
  const b = words(right);

  if (!a.size || !b.size) {
    return 0;
  }

  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) {
      intersection += 1;
    }
  });

  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
};

const categorySimilarity = (left = "", right = "") => {
  const leftCanonical = toCanonicalCategory(left);
  const rightCanonical = toCanonicalCategory(right);

  if (!leftCanonical || !rightCanonical) {
    return 0;
  }

  if (leftCanonical === rightCanonical) {
    return 1;
  }

  const tokenScore = jaccardSimilarity(leftCanonical, rightCanonical);
  return clamp(tokenScore * 0.75);
};

const locationSimilarity = (left = "", right = "") => {
  const a = normalize(left);
  const b = normalize(right);

  if (
    !a ||
    !b ||
    a === "unknown" ||
    b === "unknown" ||
    a === "n a" ||
    b === "n a"
  ) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  if (a.includes(b) || b.includes(a)) {
    return 0.72;
  }

  const tokenScore = jaccardSimilarity(a, b);
  if (tokenScore >= 0.5) {
    return 0.62;
  }

  if (tokenScore >= 0.25) {
    return 0.4;
  }

  return 0.15;
};

const dateSimilarity = (lostDate, foundDate) => {
  if (!lostDate || !foundDate) {
    return 0;
  }

  const lost = new Date(`${lostDate}T00:00:00`).getTime();
  const found = new Date(`${foundDate}T00:00:00`).getTime();

  if (Number.isNaN(lost) || Number.isNaN(found)) {
    return 0;
  }

  const diffDays = Math.abs(lost - found) / (1000 * 60 * 60 * 24);
  if (diffDays <= 1) return 1;
  if (diffDays <= 3) return 0.75;
  if (diffDays <= 7) return 0.5;
  if (diffDays <= 14) return 0.25;
  return 0;
};

const imageSimilarity = (lostReport, foundItem) => {
  if (!lostReport?.hasImage) {
    return 0;
  }

  const categoryScore =
    categorySimilarity(lostReport.category, foundItem.category) * 0.25;

  const colorScore = colorSimilarity(lostReport, foundItem) * 0.55;

  const qualityScore = clamp(Number(lostReport.scanQuality || 0) / 100) * 0.2;

  return clamp(categoryScore + colorScore + qualityScore);
};

const identifierSimilarity = (left = "", right = "") => {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  return Math.max(
    jaccardSimilarity(normalizedLeft, normalizedRight),
    bigramSimilarity(normalizedLeft, normalizedRight),
  );
};

const nameSimilarity = (left = "", right = "") =>
  Math.max(jaccardSimilarity(left, right), bigramSimilarity(left, right));

const brandSimilarity = (left = "", right = "") => {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  return bigramSimilarity(normalizedLeft, normalizedRight) * 0.7;
};

const hasMeaningfulText = (value = "") => {
  const normalized = normalize(value);
  return Boolean(
    normalized && normalized !== "unknown" && normalized !== "n a",
  );
};

const looksLikeGenericFilename = (value = "") => {
  const normalized = normalize(value);
  if (!normalized) {
    return true;
  }

  if (/^(img|image|photo|dsc|screenshot|scan)\s*\d+$/.test(normalized)) {
    return true;
  }

  if (/^p\d{6,}$/.test(normalized)) {
    return true;
  }

  return false;
};

export const getConfidenceLabel = (score) => {
  if (score >= 80) return "Strong Match";
  if (score >= 50) return "Possible Match";
  return "Weak Match";
};

export const computeMatch = (lostReport, foundItem) => {
  const categoryScore = categorySimilarity(
    lostReport.category,
    foundItem.category,
  );
  const nameScore = nameSimilarity(lostReport.itemName, foundItem.name);
  const locationScore = locationSimilarity(
    lostReport.locationLost,
    foundItem.location,
  );
  const dateScore = dateSimilarity(lostReport.dateLost, foundItem.date);
  const descriptionScore = Math.max(
    jaccardSimilarity(
      `${lostReport.description} ${lostReport.identifiers} ${lostReport.color} ${lostReport.brand || ""}`,
      `${foundItem.description} ${foundItem.brand} ${foundItem.serialNumber} ${foundItem.color}`,
    ),
    bigramSimilarity(lostReport.description, foundItem.description),
  );
  const identifierScore = identifierSimilarity(
    lostReport.identifiers,
    foundItem.serialNumber,
  );
  const brandScore = brandSimilarity(lostReport.brand, foundItem.brand);
  const imageScore = imageSimilarity(lostReport, foundItem);

  const breakdown = {
    category: Math.round(categoryScore * WEIGHTS.category),
    name: Math.round(nameScore * WEIGHTS.name),
    location: Math.round(locationScore * WEIGHTS.location),
    date: Math.round(dateScore * WEIGHTS.date),
    description: Math.round(descriptionScore * WEIGHTS.description),
    identifier: Math.round(identifierScore * WEIGHTS.identifier),
    brand: Math.round(brandScore * WEIGHTS.brand),
    image: Math.round(imageScore * WEIGHTS.image),
  };

  const rawScore = Object.values(breakdown).reduce(
    (total, value) => total + value,
    0,
  );

  const availableWeight = Object.entries(WEIGHTS).reduce(
    (sum, [key, weight]) => {
      if (key === "category") {
        return sum + (hasMeaningfulText(lostReport.category) ? weight : 0);
      }

      if (key === "name") {
        return sum + (hasMeaningfulText(lostReport.itemName) ? weight : 0);
      }

      if (key === "location") {
        return sum + (hasMeaningfulText(lostReport.locationLost) ? weight : 0);
      }

      if (key === "date") {
        return sum + (lostReport.dateLost ? weight : 0);
      }

      if (key === "description") {
        const hasDescriptionSignals =
          hasMeaningfulText(lostReport.description) ||
          hasMeaningfulText(lostReport.color);
        return sum + (hasDescriptionSignals ? weight : 0);
      }

      if (key === "identifier") {
        return (
          sum +
          (hasMeaningfulText(lostReport.identifiers) &&
          !looksLikeGenericFilename(lostReport.identifiers)
            ? weight
            : 0)
        );
      }

      if (key === "brand") {
        return sum + (hasMeaningfulText(lostReport.brand) ? weight : 0);
      }

      if (key === "image") {
        return sum + (lostReport?.hasImage ? weight : 0);
      }

      return sum;
    },
    0,
  );

  const normalizedScore = availableWeight
    ? (rawScore / availableWeight) * 100
    : 0;

  const signalEntries = [
    {
      key: "category",
      value: categoryScore,
      available: hasMeaningfulText(lostReport.category),
    },
    {
      key: "name",
      value: nameScore,
      available: hasMeaningfulText(lostReport.itemName),
    },
    {
      key: "location",
      value: locationScore,
      available: hasMeaningfulText(lostReport.locationLost),
    },
    { key: "date", value: dateScore, available: Boolean(lostReport.dateLost) },
    {
      key: "description",
      value: descriptionScore,
      available:
        hasMeaningfulText(lostReport.description) ||
        hasMeaningfulText(lostReport.color),
    },
    {
      key: "identifier",
      value: identifierScore,
      available:
        hasMeaningfulText(lostReport.identifiers) &&
        !looksLikeGenericFilename(lostReport.identifiers),
    },
    {
      key: "brand",
      value: brandScore,
      available: hasMeaningfulText(lostReport.brand),
    },
    {
      key: "image",
      value: imageScore,
      available: Boolean(lostReport?.hasImage),
    },
  ];

  const availableSignals = signalEntries.filter((entry) => entry.available);
  const supportCount = availableSignals.length;
  const strongSignalCount = availableSignals.filter(
    (entry) => entry.value >= 0.45,
  ).length;
  const veryStrongSignalCount = availableSignals.filter(
    (entry) => entry.value >= 0.72,
  ).length;

  const supportMultiplier = clamp(0.55 + Math.min(1, supportCount / 5) * 0.45);
  const consensusRatio = supportCount ? strongSignalCount / supportCount : 0;
  const consensusMultiplier = clamp(
    0.62 + consensusRatio * 0.33 + veryStrongSignalCount * 0.03,
    0.55,
    1,
  );

  let conflictPenalty = 1;
  const colorScoreOnly = colorSimilarity(lostReport, foundItem);
  if (
    lostReport?.hasImage &&
    hasMeaningfulText(lostReport.color) &&
    hasMeaningfulText(foundItem.color) &&
    colorScoreOnly === 0
  ) {
    conflictPenalty *= 0.9;
  }

  if (categoryScore < 0.25 && nameScore < 0.18) {
    conflictPenalty *= 0.86;
  }

  const gapDays = dateGapDays(lostReport.dateLost, foundItem.date);
  if (gapDays !== null && gapDays > 45) {
    conflictPenalty *= 0.92;
  }

  const coverage = availableWeight ? availableWeight / TOTAL_WEIGHT : 0;
  const coverageDamping = 0.55 + coverage * 0.45;
  const score = Math.round(
    clamp(
      (normalizedScore / 100) *
        coverageDamping *
        supportMultiplier *
        consensusMultiplier *
        conflictPenalty,
    ) * 100,
  );

  const reasons = [];
  if (breakdown.category >= 14) reasons.push("Same category");
  if (breakdown.name >= 10) reasons.push("Similar name");
  if (breakdown.location >= 8) reasons.push("Nearby location");
  if (breakdown.date >= 4) reasons.push("Close report date");
  if (breakdown.description >= 7) reasons.push("Similar description");
  if (breakdown.identifier >= 6) reasons.push("Identifier overlap");
  if (breakdown.brand >= 4) reasons.push("Brand similarity");
  if (breakdown.image >= 4) reasons.push("Image/color similarity");

  return {
    score,
    rawScore,
    normalizedScore: Math.round(normalizedScore),
    signalCoverage: Math.round(coverage * 100),
    supportCount,
    strongSignalCount,
    confidenceReliability: Math.round(
      clamp(supportMultiplier * consensusMultiplier * conflictPenalty) * 100,
    ),
    label: getConfidenceLabel(score),
    breakdown,
    reasons,
  };
};

export const rankFoundMatches = (lostReport, items, limit = 8) => {
  if (!lostReport) {
    return [];
  }

  return items
    .filter((item) => item.status === "Found")
    .map((item) => {
      const match = computeMatch(lostReport, item);
      return {
        ...item,
        match,
      };
    })
    .filter((item) => item.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, limit);
};

export const scoringWeights = WEIGHTS;
