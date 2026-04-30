# Matches Tab Matching Process

## Overview

The Matches tab currently uses a deterministic, rule-based ranking system. It does not use a trained machine learning model yet.

Instead, it builds a lost-item query profile, compares that profile against found-item records, and ranks the strongest candidates by a weighted similarity score.

The main implementation lives in:

- `src/utils/matching.js`
- `src/pages/MatchResults.jsx`

## Matching Flows

The tab supports two input modes.

### 1. Select mode

The user selects one of their existing lost reports.

That report is converted into a matching profile with fields such as:

- `itemName`
- `category`
- `locationLost`
- `dateLost`
- `description`
- `identifiers`
- `color`
- `brand`
- `paletteColors`
- `hasImage`

The matcher then compares that lost profile against all items whose status is `Found`.

### 2. Upload mode

The user uploads a single image for quick matching.

The browser performs a lightweight image scan and turns the result into a temporary lost-item profile. That temporary profile is then matched against all found items.

Upload mode is useful when the user has not created a detailed lost report yet.

## Upload Mode Image Scan

The quick-match scan is browser-side and heuristic-based. It is not a full vision model, but it extracts useful signals from the uploaded image.

### What happens during scanning

1. The image is loaded into an off-screen canvas.
2. A subject-focus step tries to isolate the likely main object instead of scanning the full frame directly.
3. The focused region is scaled down and analyzed for visual signals.
4. The system derives a temporary label and category guess using the image data plus the existing found-item database.

### Subject-focus step

The upload pipeline now tries to focus on the main object before scanning.

It does this by:

- estimating the background color from the image corners
- measuring how much each pixel differs from that background
- adding a small center-bias and edge-strength heuristic
- building a bounding box around the likely foreground subject
- expanding that box slightly for context
- falling back to full-frame scan if the detected subject area looks unreliable

This improves matching because color and quality signals are less affected by background clutter.

### Visual signals extracted

The scan currently extracts:

- dominant color
- up to 3 palette colors
- image quality score
- image quality hints
- whether subject focus was applied
- approximate focus coverage

### Quality scoring

The scan quality score is based on:

- exposure
- contrast
- sharpness

The app also generates hints when the image is:

- blurry
- low contrast
- too dark or too bright
- too far from the subject
- hard to isolate from the background

### Label and category inference

After scanning, the app tries to infer a better query label:

- If the filename is descriptive, it may help.
- If the filename is generic like `IMG1234`, it is treated as weak evidence.
- The app compares detected colors and filename tokens against found items in the database.
- It may infer a category and a better label from similar found-item names.

The quick-match profile is then built from:

- detected label
- inferred category
- dominant color
- palette colors
- scan quality
- scan confidence
- filename, if useful

## Candidate Pool

Regardless of the input mode, the matcher only ranks items whose status is `Found`.

This filtering happens in `rankFoundMatches()` inside `src/utils/matching.js`.

## Core Matching Technique

The current technique is best described as:

**Hybrid Rule-Based Similarity Ranking**

It is hybrid because it combines multiple evidence types:

- text similarity
- category normalization
- location similarity
- date proximity
- identifier similarity
- brand similarity
- image-derived cues

It is rule-based because:

- there is no model training step
- weights are manually defined
- scoring behavior is deterministic
- the same inputs always produce the same result

## Base Weights

The matcher starts with these base weights:

| Signal | Weight |
|---|---:|
| Category | 20 |
| Name | 20 |
| Location | 12 |
| Date | 8 |
| Description | 15 |
| Identifier | 10 |
| Brand | 7 |
| Image | 8 |

Total base weight: `100`

### Weight shift when an image is involved

If the lost-side query has an image, the matcher uses a different effective weighting:

| Signal | Weight with Image |
|---|---:|
| Category | 22 |
| Name | 22 |
| Location | 8 |
| Date | 6 |
| Description | 18 |
| Identifier | 8 |
| Brand | 6 |
| Image | 18 |

This gives more influence to visual and descriptive signals when the query includes image evidence.

## Similarity Functions Used

### 1. Category similarity

Category comparison first normalizes common aliases, for example:

- `gadget` -> `electronics`
- `wallet` -> `accessories`
- `id card` -> `id`

If the normalized categories are equal, the category score is `1.0`.

If not, the matcher falls back to token overlap and scales that result down.

### 2. Name similarity

Name similarity uses the maximum of:

- Jaccard token similarity
- bigram similarity

This helps when the wording is similar but not identical.

### 3. Location similarity

Location matching is text-based:

- exact match -> `1.0`
- containment/overlap -> `0.72`
- moderate token overlap -> `0.62` or `0.4`
- weak relation -> `0.15`
- missing or placeholder values like `Unknown` -> `0`

### 4. Date similarity

Date similarity is based on the gap in days:

- <= 1 day -> `1.0`
- <= 3 days -> `0.75`
- <= 7 days -> `0.5`
- <= 14 days -> `0.25`
- beyond that -> `0`

### 5. Description similarity

Description similarity combines lost-side text with related details:

- description
- identifiers
- color
- brand

It compares those against found-side:

- description
- brand
- serial number
- color

The matcher uses the stronger of:

- Jaccard similarity on the combined text
- bigram similarity on the main descriptions

### 6. Identifier similarity

Identifier similarity uses:

- exact match
- token overlap
- bigram similarity

This signal is especially useful for:

- serial numbers
- labels
- tags
- unique printed text

Generic filenames are intentionally treated as low-value identifier input.

### 7. Brand similarity

Brand similarity uses normalized text and bigram similarity, with full credit for exact matches.

### 8. Image similarity

Image similarity is still heuristic-based, not embedding-based.

It combines:

- label similarity between the query and found item
- color similarity between canonical color groups
- category similarity
- descriptor similarity from text/color context
- scan quality score
- image confidence score

Internally, image similarity is composed approximately as:

- label-related score: `58%`
- color score: `27%`
- category contribution: `8%`
- descriptor contribution: `4%`
- scan quality contribution: `2%`
- confidence contribution: `1%`

## Canonical Color Matching

Colors are normalized into groups such as:

- black
- white
- gray
- blue
- green
- red
- pink
- yellow
- orange
- brown
- purple

This allows related descriptions like `navy`, `olive`, `khaki`, or `maroon` to contribute to a color match.

## How the Final Score Is Computed

The final score is not just a raw weighted sum. It goes through several stages.

### Stage 1: Per-signal weighted breakdown

Each similarity signal produces a 0 to 1 score.

That score is multiplied by the effective weight for that signal.

Example structure:

```text
breakdown.category    = categoryScore * weight.category
breakdown.name        = nameScore * weight.name
breakdown.location    = locationScore * weight.location
breakdown.date        = dateScore * weight.date
breakdown.description = descriptionScore * weight.description
breakdown.identifier  = identifierScore * weight.identifier
breakdown.brand       = brandScore * weight.brand
breakdown.image       = imageScore * weight.image
```

### Stage 2: Raw score

The weighted parts are added together:

```text
rawScore = sum(all weighted breakdown values)
```

### Stage 3: Available-weight normalization

The matcher does not always use the full 100 possible weight.

If a query is missing meaningful signals, those weights are removed from the denominator. For example:

- missing date removes date weight
- missing brand removes brand weight
- generic filename does not count as a useful identifier
- no image removes image weight

Then:

```text
normalizedScore = rawScore / availableWeight * 100
```

This prevents incomplete reports from being punished unfairly just because certain fields were blank.

### Stage 4: Support and consensus adjustment

The matcher then looks at how many useful signals were available and how many of them strongly agree.

It computes:

- `supportCount`
- `strongSignalCount`
- `veryStrongSignalCount`

From those it derives:

- `supportMultiplier`
- `consensusMultiplier`

These reward matches that are supported by multiple signals rather than only one.

### Stage 5: Conflict penalties and bonuses

The matcher also applies conflict logic, for example:

- color mismatch when both sides explicitly specify color
- weak image similarity combined with weak category/name agreement
- very large date gaps

It can also apply a small bonus when:

- image similarity is strong
- and category or name similarity is also strong

### Stage 6: Coverage damping

The matcher computes signal coverage from the ratio:

```text
coverage = availableWeight / totalEffectiveWeight
```

That coverage is then damped slightly before the final score is produced.

This helps keep the score realistic when only a small portion of the expected evidence is present.

### Stage 7: Final score

The final match score is:

```text
finalScore =
  normalizedScore
  * coverageDamping
  * supportMultiplier
  * consensusMultiplier
  * conflictPenalty
```

The value is clamped and converted to a percentage from `0` to `100`.

## Confidence Labels

The matcher currently labels scores as:

- `80% and above` -> `Strong Match`
- `50% to 79%` -> `Possible Match`
- `Below 50%` -> `Weak Match`

The Matches tab also uses `80%+` as the high-confidence filter threshold.

## Match Reasons Shown in the UI

The matcher also produces human-readable reasons. These are generated from the weighted breakdown when a signal crosses a threshold.

Possible reasons include:

- Same category
- Similar name
- Nearby location
- Close report date
- Similar description
- Identifier overlap
- Brand similarity
- Image/color similarity

This makes the ranking more explainable to the user.

## Output Returned by `computeMatch()`

Each candidate returns a match object with fields such as:

- `score`
- `rawScore`
- `normalizedScore`
- `signalCoverage`
- `supportCount`
- `strongSignalCount`
- `confidenceReliability`
- `label`
- `breakdown`
- `reasons`

This output is what powers:

- the percentage shown in the Matches tab
- the confidence label
- the explanation chips / reasons

## Ranking Behavior

`rankFoundMatches()`:

1. filters the item list to `Found` items only
2. computes a match object for each candidate
3. discards zero-score candidates
4. sorts descending by `match.score`
5. returns only the top results

The Matches page currently asks for up to 20 ranked candidates from this function.

## What This System Is Good At

The current approach works well for:

- structured item reports
- partial but still meaningful text data
- matching on category, name, brand, location, and identifiers
- using image color and quality signals without needing a backend vision model
- explainable ranking

## Current Limitations

The current system is still heuristic-based, so it has limits:

- it does not use image embeddings
- it does not perform real object recognition
- it does not learn from confirmed claims yet
- unusual items can still be hard to identify from image alone
- background-heavy images can still reduce scan quality if subject isolation is weak

## Recommended Future Upgrades

The next step toward a more ML-driven matcher would be:

- image embeddings from a vision model
- text embeddings for item descriptions
- supervised calibration using confirmed match outcomes
- feedback from accepted/rejected claims
- hybrid ranking that combines deterministic rules with learned similarity

## Summary

The Matches tab currently uses a hybrid rule-based similarity matcher.

It compares a lost-side query against found items using:

- category
- name
- location
- date
- description
- identifiers
- brand
- image-derived signals

In upload mode, the browser now tries to isolate the main object before scanning the image, then uses color, quality, and inferred label/category cues to build a temporary query profile.

The final percentage is not a simple sum. It is a weighted, normalized, coverage-aware, conflict-adjusted score designed to rank the most credible matches first while keeping the process explainable.
