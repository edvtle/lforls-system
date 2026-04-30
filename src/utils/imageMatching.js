const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const loadImage = (source, crossOrigin = false) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

const createCanvas = (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const drawImageToCanvas = (image, maxSide = 220) => {
  const scale = Math.min(
    1,
    maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1),
  );
  const width = Math.max(24, Math.round((image.naturalWidth || 1) * scale));
  const height = Math.max(24, Math.round((image.naturalHeight || 1) * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  return { canvas, context, width, height };
};

const createCornerSamples = ({ width, height, marginX, marginY }) => [
  { startX: 0, endX: marginX, startY: 0, endY: marginY },
  { startX: width - marginX, endX: width, startY: 0, endY: marginY },
  { startX: 0, endX: marginX, startY: height - marginY, endY: height },
  { startX: width - marginX, endX: width, startY: height - marginY, endY: height },
];

const getAverageBackgroundColor = (pixels, width, height) => {
  const marginX = Math.max(4, Math.floor(width * 0.12));
  const marginY = Math.max(4, Math.floor(height * 0.12));
  const samples = createCornerSamples({ width, height, marginX, marginY });

  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  samples.forEach(({ startX, endX, startY, endY }) => {
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const index = (y * width + x) * 4;
        const alpha = pixels[index + 3];
        if (alpha < 60) {
          continue;
        }

        red += pixels[index];
        green += pixels[index + 1];
        blue += pixels[index + 2];
        count += 1;
      }
    }
  });

  if (!count) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: red / count,
    g: green / count,
    b: blue / count,
  };
};

const clampBox = (box, width, height) => {
  const nextWidth = Math.max(1, Math.min(width, box.width));
  const nextHeight = Math.max(1, Math.min(height, box.height));
  const nextX = Math.max(0, Math.min(width - nextWidth, box.x));
  const nextY = Math.max(0, Math.min(height - nextHeight, box.y));

  return {
    x: nextX,
    y: nextY,
    width: nextWidth,
    height: nextHeight,
  };
};

const detectSubjectBox = (context, width, height) => {
  const pixels = context.getImageData(0, 0, width, height).data;
  const background = getAverageBackgroundColor(pixels, width, height);
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const maxCenterDistance = Math.sqrt(centerX * centerX + centerY * centerY) || 1;

  const scoreMap = new Float32Array(width * height);
  let scoreSum = 0;
  let scoreCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = pixels[index + 3];
      if (alpha < 60) {
        continue;
      }

      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const colorDistance =
        (Math.abs(red - background.r) +
          Math.abs(green - background.g) +
          Math.abs(blue - background.b)) /
        (255 * 3);

      const leftIndex = x > 0 ? index - 4 : index;
      const upIndex = y > 0 ? index - width * 4 : index;
      const edgeStrength =
        (Math.abs(red - pixels[leftIndex]) +
          Math.abs(green - pixels[leftIndex + 1]) +
          Math.abs(blue - pixels[leftIndex + 2]) +
          Math.abs(red - pixels[upIndex]) +
          Math.abs(green - pixels[upIndex + 1]) +
          Math.abs(blue - pixels[upIndex + 2])) /
        (255 * 6);

      const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const centerBias = 1 - distanceFromCenter / maxCenterDistance;
      const score = colorDistance * 0.66 + edgeStrength * 0.24 + centerBias * 0.1;

      scoreMap[y * width + x] = score;
      scoreSum += score;
      scoreCount += 1;
    }
  }

  if (!scoreCount) {
    return {
      box: { x: 0, y: 0, width, height },
      applied: false,
      background,
    };
  }

  const threshold = Math.max(0.18, scoreSum / scoreCount + 0.045);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (scoreMap[y * width + x] < threshold) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      box: { x: 0, y: 0, width, height },
      applied: false,
      background,
    };
  }

  const rawBox = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };

  const expandedBox = clampBox(
    {
      x: Math.floor(rawBox.x - rawBox.width * 0.14),
      y: Math.floor(rawBox.y - rawBox.height * 0.14),
      width: Math.ceil(rawBox.width * 1.28),
      height: Math.ceil(rawBox.height * 1.28),
    },
    width,
    height,
  );

  const focusRatio = (expandedBox.width * expandedBox.height) / (width * height);
  const applied =
    focusRatio >= 0.06 &&
    focusRatio <= 0.94 &&
    expandedBox.width >= width * 0.16 &&
    expandedBox.height >= height * 0.16;

  return {
    box: applied ? expandedBox : { x: 0, y: 0, width, height },
    applied,
    background,
  };
};

const cropCanvas = (canvas, cropBox) => {
  const nextCanvas = createCanvas(cropBox.width, cropBox.height);
  const context = nextCanvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.drawImage(
    canvas,
    cropBox.x,
    cropBox.y,
    cropBox.width,
    cropBox.height,
    0,
    0,
    cropBox.width,
    cropBox.height,
  );

  return nextCanvas;
};

const normalizeCanvas = (canvas, size = 48) => {
  const nextCanvas = createCanvas(size, size);
  const context = nextCanvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  const scale = Math.min(size / canvas.width, size / canvas.height);
  const drawWidth = Math.max(1, Math.round(canvas.width * scale));
  const drawHeight = Math.max(1, Math.round(canvas.height * scale));
  const offsetX = Math.floor((size - drawWidth) / 2);
  const offsetY = Math.floor((size - drawHeight) / 2);
  context.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);

  return nextCanvas;
};

const rotateCanvas = (canvas, quarterTurns = 0) => {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) {
    return canvas;
  }

  const rotated = createCanvas(canvas.width, canvas.height);
  const context = rotated.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return canvas;
  }

  context.translate(rotated.width / 2, rotated.height / 2);
  context.rotate((Math.PI / 2) * turns);
  context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return rotated;
};

const buildAverageHash = (luminanceValues) => {
  const average =
    luminanceValues.reduce((sum, value) => sum + value, 0) /
    Math.max(1, luminanceValues.length);

  return luminanceValues.map((value) => (value >= average ? 1 : 0));
};

const buildDifferenceHash = (luminanceValues, size) => {
  const hash = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const index = y * size + x;
      hash.push(luminanceValues[index] <= luminanceValues[index + 1] ? 1 : 0);
    }
  }

  return hash;
};

const buildShapeGrid = (pixels, width, height, background) => {
  const gridSize = 6;
  const grid = [];
  const cellWidth = width / gridSize;
  const cellHeight = height / gridSize;

  for (let gridY = 0; gridY < gridSize; gridY += 1) {
    for (let gridX = 0; gridX < gridSize; gridX += 1) {
      const startX = Math.floor(gridX * cellWidth);
      const endX = Math.floor((gridX + 1) * cellWidth);
      const startY = Math.floor(gridY * cellHeight);
      const endY = Math.floor((gridY + 1) * cellHeight);

      let foreground = 0;
      let count = 0;

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const index = (y * width + x) * 4;
          const alpha = pixels[index + 3];
          if (alpha < 60) {
            continue;
          }

          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const colorDistance =
            (Math.abs(red - background.r) +
              Math.abs(green - background.g) +
              Math.abs(blue - background.b)) /
            (255 * 3);

          if (colorDistance >= 0.16) {
            foreground += 1;
          }
          count += 1;
        }
      }

      grid.push(count ? foreground / count : 0);
    }
  }

  return grid;
};

const getEdgeDensity = (luminanceValues, size) => {
  let gradientSum = 0;
  let count = 0;

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const index = y * size + x;
      gradientSum += Math.abs(luminanceValues[index + 1] - luminanceValues[index]);
      gradientSum += Math.abs(luminanceValues[index + size] - luminanceValues[index]);
      count += 2;
    }
  }

  return count ? clamp(gradientSum / (count * 255)) : 0;
};

const averageAbsoluteDifference = (left = [], right = []) => {
  if (!left.length || !right.length || left.length !== right.length) {
    return 1;
  }

  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += Math.abs(left[index] - right[index]);
  }

  return total / left.length;
};

const bitArraySimilarity = (left = [], right = []) => {
  if (!left.length || !right.length || left.length !== right.length) {
    return 0;
  }

  let matches = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) {
      matches += 1;
    }
  }

  return matches / left.length;
};

const buildOrientationSignature = (canvas, background) => {
  const size = canvas.width;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  const pixels = context.getImageData(0, 0, size, size).data;
  const luminanceValues = [];
  let redSum = 0;
  let greenSum = 0;
  let blueSum = 0;
  let pixelCount = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const luminance = alpha < 60 ? 255 : 0.2126 * red + 0.7152 * green + 0.0722 * blue;

    luminanceValues.push(luminance);

    if (alpha >= 60) {
      redSum += red;
      greenSum += green;
      blueSum += blue;
      pixelCount += 1;
    }
  }

  if (!pixelCount) {
    return null;
  }

  return {
    averageHash: buildAverageHash(luminanceValues),
    differenceHash: buildDifferenceHash(luminanceValues, size),
    shapeGrid: buildShapeGrid(pixels, size, size, background),
    averageColor: {
      r: redSum / pixelCount,
      g: greenSum / pixelCount,
      b: blueSum / pixelCount,
    },
    edgeDensity: getEdgeDensity(luminanceValues, size),
  };
};

const buildVisualSignature = (image) => {
  const drawn = drawImageToCanvas(image);
  if (!drawn) {
    return null;
  }

  const subject = detectSubjectBox(drawn.context, drawn.width, drawn.height);
  const croppedCanvas = cropCanvas(drawn.canvas, subject.box) || drawn.canvas;
  const normalizedCanvas = normalizeCanvas(croppedCanvas, 48);
  if (!normalizedCanvas) {
    return null;
  }

  const orientations = [0, 1, 2, 3]
    .map((turns) => rotateCanvas(normalizedCanvas, turns))
    .map((canvas) => buildOrientationSignature(canvas, subject.background))
    .filter(Boolean);

  if (!orientations.length) {
    return null;
  }

  return {
    orientations,
    aspectRatio:
      subject.box.height > 0 ? subject.box.width / subject.box.height : 1,
    focusApplied: subject.applied,
    coverage:
      (subject.box.width * subject.box.height) / Math.max(1, drawn.width * drawn.height),
  };
};

export const createVisualSignatureFromFile = async (file) => {
  if (!(file instanceof File)) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    return buildVisualSignature(image);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const createVisualSignatureFromUrl = async (url) => {
  if (!url) {
    return null;
  }

  try {
    const image = await loadImage(url, true);
    return buildVisualSignature(image);
  } catch {
    return null;
  }
};

const compareOrientationSignatures = (left, right) => {
  if (!left || !right) {
    return 0;
  }

  const averageHashSimilarity = bitArraySimilarity(left.averageHash, right.averageHash);
  const differenceHashSimilarity = bitArraySimilarity(
    left.differenceHash,
    right.differenceHash,
  );
  const shapeSimilarity = 1 - averageAbsoluteDifference(left.shapeGrid, right.shapeGrid);
  const colorDistance =
    (Math.abs((left.averageColor?.r || 0) - (right.averageColor?.r || 0)) +
      Math.abs((left.averageColor?.g || 0) - (right.averageColor?.g || 0)) +
      Math.abs((left.averageColor?.b || 0) - (right.averageColor?.b || 0))) /
    (255 * 3);
  const colorSimilarity = 1 - colorDistance;
  const edgeSimilarity =
    1 - Math.min(1, Math.abs((left.edgeDensity || 0) - (right.edgeDensity || 0)));

  return clamp(
    averageHashSimilarity * 0.28 +
      differenceHashSimilarity * 0.26 +
      shapeSimilarity * 0.3 +
      colorSimilarity * 0.1 +
      edgeSimilarity * 0.06,
  );
};

export const compareVisualSignatures = (left, right) => {
  if (!left?.orientations?.length || !right?.orientations?.length) {
    return 0;
  }

  let bestScore = 0;
  left.orientations.forEach((leftOrientation) => {
    right.orientations.forEach((rightOrientation) => {
      const score = compareOrientationSignatures(leftOrientation, rightOrientation);
      if (score > bestScore) {
        bestScore = score;
      }
    });
  });

  const aspectSimilarity =
    1 -
    Math.min(
      1,
      Math.abs((left.aspectRatio || 1) - (right.aspectRatio || 1)) /
        Math.max(left.aspectRatio || 1, right.aspectRatio || 1, 1),
    );
  const coverageSimilarity =
    1 - Math.min(1, Math.abs((left.coverage || 1) - (right.coverage || 1)));
  const focusBonus =
    left.focusApplied && right.focusApplied ? 0.02 : 0;

  const blended = clamp(
    bestScore * 0.9 + aspectSimilarity * 0.06 + coverageSimilarity * 0.04 + focusBonus,
  );

  if (bestScore >= 0.95) {
    return clamp(Math.max(blended, 0.97));
  }

  if (bestScore >= 0.88 && aspectSimilarity >= 0.84) {
    return clamp(Math.max(blended, 0.9));
  }

  return blended;
};
