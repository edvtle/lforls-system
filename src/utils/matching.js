const WEIGHTS = {
  category: 30,
  name: 25,
  location: 15,
  date: 10,
  description: 10,
  image: 10,
};

const normalize = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const words = (value = "") => new Set(normalize(value).split(" ").filter(Boolean));

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

const locationSimilarity = (left = "", right = "") => {
  const a = normalize(left);
  const b = normalize(right);

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  if (a.includes(b) || b.includes(a)) {
    return 0.65;
  }

  return 0.2;
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

  const categoryScore = lostReport.category && lostReport.category === foundItem.category ? 0.7 : 0.3;
  const colorScore =
    lostReport.color && foundItem.color && normalize(lostReport.color) === normalize(foundItem.color) ? 0.3 : 0;

  return Math.min(1, categoryScore + colorScore);
};

export const getConfidenceLabel = (score) => {
  if (score >= 80) return "Strong Match";
  if (score >= 50) return "Possible Match";
  return "Weak Match";
};

export const computeMatch = (lostReport, foundItem) => {
  const categoryScore = lostReport.category === foundItem.category ? 1 : 0;
  const nameScore = jaccardSimilarity(lostReport.itemName, foundItem.name);
  const locationScore = locationSimilarity(lostReport.locationLost, foundItem.location);
  const dateScore = dateSimilarity(lostReport.dateLost, foundItem.date);
  const descriptionScore = jaccardSimilarity(
    `${lostReport.description} ${lostReport.identifiers}`,
    `${foundItem.description} ${foundItem.brand} ${foundItem.serialNumber}`
  );
  const imageScore = imageSimilarity(lostReport, foundItem);

  const breakdown = {
    category: Math.round(categoryScore * WEIGHTS.category),
    name: Math.round(nameScore * WEIGHTS.name),
    location: Math.round(locationScore * WEIGHTS.location),
    date: Math.round(dateScore * WEIGHTS.date),
    description: Math.round(descriptionScore * WEIGHTS.description),
    image: Math.round(imageScore * WEIGHTS.image),
  };

  const score = Object.values(breakdown).reduce((total, value) => total + value, 0);

  const reasons = [];
  if (breakdown.category >= 20) reasons.push("Same category");
  if (breakdown.name >= 10) reasons.push("Similar name");
  if (breakdown.location >= 10) reasons.push("Nearby location");
  if (breakdown.date >= 5) reasons.push("Close report date");
  if (breakdown.description >= 5) reasons.push("Similar description");
  if (breakdown.image >= 5) reasons.push("Image-level similarity");

  return {
    score,
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
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, limit);
};

export const scoringWeights = WEIGHTS;
