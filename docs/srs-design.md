# Spaced Repetition (SRS) Design

## Overview
This feature adds a client-side spaced repetition review mode using a simplified SM-2 algorithm.
It is separate from the existing "Review Incorrect" flow.

## Data Model
Stored in localStorage under `wordmaster-srs-v1` as a JSON object keyed by:

`book|chapter|word`

Each entry has:
- `reps`: number of successful reviews
- `intervalDays`: days until next review
- `ease`: difficulty factor (floored at 1.3)
- `lastReviewed`: epoch ms of last review
- `nextDue`: epoch ms when the item becomes due

## Scheduling Algorithm (SM-2)
Quality `q` is binary:
- Correct => `q = 5`
- Incorrect => `q = 2`

Ease update:
```
ease = max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
```

Interval update:
- If `q < 3`: `reps = 0`, `intervalDays = 1`
- Else:
  - `reps += 1`
  - `reps == 1` => `intervalDays = 1`
  - `reps == 2` => `intervalDays = 6`
  - `reps >= 3` => `intervalDays = round(prevInterval * ease)`

`nextDue = now + intervalDays * 86400000`

## Seeding from Mastered
Existing `wordmaster-mastered` words are seeded once into SRS:
- `reps = 1`
- `intervalDays = 1`
- `ease = 2.5`
- `nextDue = now + 1 day`

Seeding only occurs if SRS data is empty and not already seeded.

## UI Behavior
- "Review Due" appears only in Library mode.
- Button count shows items with `nextDue <= now`.
- Starting "Review Due" loads only due words for the selected book/chapter.
- "Review Incorrect" is unchanged and remains separate.
