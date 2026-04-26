# Matches Tab Matching Process

## Overview

The Matches tab does not use a trained machine learning model yet. It uses a rule-based scoring system that compares a selected lost item or an uploaded image against the items in the database.

The goal is to rank the most likely matches first by combining text, metadata, and image-derived signals.

## What the Matches Tab Does

The tab supports two matching flows:

1. Select mode
   - The user selects one of their lost reports.
   - The system compares that report against all found items in the database.

2. Upload mode
   - The user uploads an image.
   - The system scans the image for visual cues such as color, basic image quality, and filename hints.
   - Those cues are converted into a temporary lost-item profile.
   - The temporary profile is then matched against found items.

## If The User Only Uploads An Image

When the user uploads only an image, the system follows a lightweight browser-side scan and matching flow:

1. The file is loaded in the browser as an image preview.
2. The image is drawn into a hidden canvas so pixels can be read.
3. The scan checks the image for:

- dominant color
- secondary palette colors
- brightness and contrast
- sharpness or blur level

4. The system looks at the filename too.

- If the filename is descriptive, it may help identify the item.
- If the filename is generic like IMG1234, it is treated as low-value.

5. The scan results are turned into a temporary item profile.

- The profile includes a guessed label, color, palette colors, and scan quality.

6. That temporary profile is matched against all found items in the database.
7. The results are ranked by confidence and shown in the Matches tab.

This process improves accuracy because the match does not depend only on the filename. It uses visual signals from the image itself.

## Inputs Used For Matching

The matcher compares the current lost-item profile against each found item using these fields:

- Item name
- Category
- Location
- Date
- Description
- Identifiers such as serial number or tags
- Brand
- Image-related signals

## How The Scoring Works

Each candidate match gets a score based on how closely it resembles the lost-item profile.

The score is built from several parts:

- Category similarity
  - Exact matches are rewarded most strongly.
  - Common aliases are also recognized.

- Name similarity
  - The item names are compared using token matching and character-level similarity.

- Location similarity
  - Nearby or overlapping location text increases the score.

- Date similarity
  - Items reported around the same time score higher.

- Description similarity
  - Descriptions, identifiers, color, and brand hints are compared together.

- Identifier similarity
  - Serial numbers, labels, tags, and other distinctive markers raise confidence.

- Brand similarity
  - Matching brand text improves the score.

- Image similarity
  - If the lost report has an image, the matcher uses color and scan-quality signals.

## Main Technique Used

The main technique is called:

## Hybrid Rule-Based Similarity Ranking

This is the title/name of the matching process used in the Matches tab.

It can also be described as:

- Hybrid Rule-Based Matcher
- Weighted Similarity Scoring
- Multi-Signal Candidate Ranking
- Explainable Lost-and-Found Matching System

The system is "hybrid" because it combines multiple signals:

- Text signals
- Category signals
- Location and date signals
- Identifier and brand signals
- Basic image-derived signals

The system is "rule-based" because it does not learn from training data yet. The scoring behavior is manually defined through rules, weights, and similarity formulas.

It is not a trained AI model. Instead, it combines several deterministic scoring rules:

- Text similarity for names and descriptions
- Category matching and category aliases
- Location and date closeness
- Identifier and brand overlap
- Simple image analysis for colors and scan quality

Each of those signals is weighted, then combined into a final match percentage.

In practice, this behaves like a lightweight expert system:

- It uses known rules to compare items.
- It ranks the strongest candidates first.
- It explains why a match was suggested.

This approach works well for structured lost-and-found data, especially when reports include useful item details or a clear image.

## Applications And Techniques Used

The Matches tab uses several lightweight matching techniques. These are the actual techniques applied in the current implementation:

| Application Area | Technique Used | Purpose |
|---|---|---|
| Item name matching | Token matching and bigram similarity | Compares item names even when wording is slightly different |
| Description matching | Jaccard similarity and bigram similarity | Finds overlap between descriptive text, color, identifiers, and brand hints |
| Category matching | Category normalization and alias mapping | Treats related words as the same category, such as gadget and electronics |
| Location matching | Text overlap and containment matching | Gives higher score when locations are exact, nearby, or share keywords |
| Date matching | Date-distance scoring | Gives higher score when lost and found dates are close |
| Identifier matching | Exact match, token overlap, and bigram similarity | Gives strong weight to serial numbers, labels, tags, and unique markings |
| Brand matching | Text normalization and character similarity | Rewards matching brand names |
| Image upload scanning | Browser canvas pixel analysis | Extracts dominant color, palette colors, brightness, contrast, and sharpness |
| Image-based matching | Color-group matching and scan-quality scoring | Uses image color and quality signals to improve candidate ranking |
| Final ranking | Weighted score normalization | Combines all available signals into a final percentage |
| Result explanation | Rule-based reason generation | Shows why an item was suggested as a match |

### Technique Title For Documentation

For formal documentation, the recommended title is:

**Hybrid Rule-Based Similarity Ranking for Lost-and-Found Item Matching**

This title is accurate because the system:

1. Uses rules instead of a trained neural network.
2. Combines multiple data sources.
3. Scores each candidate using weighted similarity.
4. Ranks found items based on the final confidence percentage.

### Short Version

If a shorter title is needed, use:

**Weighted Similarity Matching**

This is simpler and still describes the core process.

### Accuracy Percentage

The percentage shown in the Matches tab is the final match score after weighting and calibration.

In simple terms:

1. Each signal gets a weighted score.
2. The system adds those points together to get a raw score.
3. The raw score is adjusted for how many useful signals were actually available.
4. The result is converted to a percentage between 0 and 100.

The scoring logic is effectively:

```text
rawScore = category + name + location + date + description + identifier + brand + image
normalizedScore = rawScore / availableWeight * 100
finalAccuracy = normalizedScore adjusted by signal coverage and confidence reliability
```

This means:

- More matching evidence increases the percentage.
- Missing fields do not unfairly punish the score.
- Weak or conflicting signals reduce confidence.
- Strong agreement across multiple fields pushes the percentage higher.

The app also uses match labels to help interpret the result:

- 80% and above: Strong Match
- 50% to 79%: Possible Match
- Below 50%: Weak Match

## Upload Mode Image Scanning

Upload mode performs a lightweight browser-side image scan. This is not object detection or full computer vision, but it helps improve matching quality.

The scan extracts:

- Dominant color
- Top palette colors
- Image quality score
- Quality hints when the image is blurry, low-contrast, or poorly lit

It also tries to infer a better item label when the file name is generic, such as IMG1234 or DSC0001.

## Confidence And Ranking

Each candidate item receives:

- A raw similarity score
- A normalized score
- A signal coverage value
- A confidence label:
  - Strong Match
  - Possible Match
  - Weak Match

The final ranking is based on the adjusted score, so items with stronger evidence appear first.

## Why This Is Not True Machine Learning Yet

This system is intelligent, but it is still rule-based.

It does not currently train on past match outcomes or use image embeddings from a vision model.

That means:

- It works well for structured item data.
- It can handle many common lost-and-found cases.
- It is not guaranteed to understand every object type perfectly.

## Strengths Of The Current Approach

- Fast and runs entirely in the browser for scanning.
- Easy to explain and debug.
- Works with incomplete item reports.
- Uses multiple signals instead of relying on only one field.

## Current Limitations

- It cannot recognize a specific object visually the way a real vision model can.
- It depends on the quality of the item report and uploaded image.
- Very unusual items may not score as accurately without more training data.

## Recommended Future Upgrade

For near-perfect matching accuracy, the next step would be to add a real vision and ranking pipeline:

- Image embeddings from a model such as CLIP or ViT
- Supervised calibration using confirmed matches
- Feedback from accepted and rejected claims
- Hybrid ranking that combines text, metadata, and image embeddings

## Summary

The Matches tab uses a hybrid rule-based matcher. It compares lost and found items using text, metadata, and simple image analysis, then ranks the best candidates by confidence. The current process is designed to be practical, explainable, and accurate for common lost-and-found cases.
