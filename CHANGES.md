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
