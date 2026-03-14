# Changes — feature/srs-review-due

**Branch**: `feature/srs-review-due`
**Base**: `main`
**Date**: 2026-03-13
**Version**: `202603130001`

---

## Features

### Spaced Repetition (SRS) Review Mode (`abf761a`)
- Added a new "Review Due" mode using a simplified SM-2 algorithm.
- Items are scheduled based on performance (Correct: quality 5, Incorrect: quality 2).
- Ease factor and intervals (1, 6, 17+ days) update dynamically to optimize long-term retention.
- "Review Due (N)" button appears in Library mode when words are ready for review.
- Automatic seeding: Existing mastered words are automatically imported into the SRS system on first load.

### Improved SRS UX (`876ca7c`)
- Added clear visual feedback for due word counts.
- SRS state updates immediately after each answer in SRS mode.
- Correctly answered words in regular quiz mode are automatically added to SRS.

---

## Bug Fixes

### Feedback Persistence (`6c72aec`)
- Fixed a bug where feedback from a previous quiz would persist after restarting.
- Feedback is now explicitly cleared when the quiz is reset or started.

### UI Consistency (`876ca7c`)
- Fixed duplicate button references in `app.js`.
- Improved button labels with proper spacing (e.g., "Review Due (5)" instead of "Review Due(5)").

---

## Testing

### Automated Playwright Suite (`f495916`)
- Expanded `tests/test-automated.js` with comprehensive SRS coverage:
  - Button visibility and count updates.
  - Memory curve state verification (reps, interval, ease).
  - Feedback clearing on restart.
- Added `tests/test-srs.js` for unit testing the SM-2 scheduling logic.

---

## Housekeeping

- Updated `TEST_PLAN.md` with detailed SRS verification steps.
- Version bumped to `202603130001` with cache-busting updates in `index.html` and `src/app.js`.

---

# Changes — feature/dictionary-definitions

**Branch**: `feature/dictionary-definitions`  
**Base**: `main`  
**Date**: 2026-02-28  
**Version**: `202602280006`

---

## Features

### Real Dictionary Definitions (`e5da0d2`)
- Added a `definition` field to every word entry in `src/data/library.js`
- Definitions sourced from [FreeDictionaryAPI](https://api.dictionaryapi.dev) (Wiktionary-backed, free, no API key)
- **625 / 654 words** resolved with real definitions (95.6% coverage)
- 29 words (contractions like `it's`, `we'll`; function words like `their`, `they're`) have no Wiktionary entry and silently fall back to the existing hand-authored `meaning` field
- Quiz feedback now shows the real dictionary definition where available (`definition || meaning`)

### New Utility Scripts
| Script | Purpose |
|---|---|
| `scripts/fetch-definitions.js` | Batch-fetch definitions for all words; use when adding new word lists |
| `scripts/retry-null-definitions.js` | Retry only `null` entries; run multiple times to work around the 1,000 req/hr API rate limit |

---

## Bug Fixes

### Empty Spelling Submission Blocked (`7a476cf`)
- Submitting the Check button (or pressing Enter) with an empty spelling field no longer counts as incorrect or advances the quiz
- The spelling input now shakes and flashes red as a visual cue that input is required

---

## Housekeeping

- **Version format** changed from git short hash to `YYYYMMDDHHmm` timestamp (`202602280006`)
- **Version displayed in footer** of the main page (subtle, muted)
- Cache-busting `?v=` query strings updated in `index.html` and `src/app.js` imports
