#!/usr/bin/env node
/**
 * fetch-definitions.js
 *
 * Batch-fetches real dictionary definitions from the Free Dictionary API
 * (https://api.dictionaryapi.dev) for every word in library.js, then
 * writes the enriched data back to the same file.
 *
 * Usage:
 *   node scripts/fetch-definitions.js
 *
 * Adds a `definition` field to each word object.
 * Words the API cannot find keep `definition: null`.
 * All existing fields (word, meaning, root) are preserved.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY_PATH = path.join(__dirname, '..', 'src', 'data', 'library.js');
const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDefinition(word) {
    try {
        const url = `${API_BASE}/${encodeURIComponent(word.toLowerCase())}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
        return def ?? null;
    } catch {
        return null;
    }
}

// ── Load library data by eval-ing the JS source ───────────────────────────────
// We strip the ES module export and eval to get the raw data objects.

const rawSource = fs.readFileSync(LIBRARY_PATH, 'utf8');

// Extract the wordlyLibrary export object by evaluating the file
// Replace "export const wordlyLibrary" with "globalThis.__lib ="
const evalSource = rawSource
    .replace(/^export\s+const\s+wordlyLibrary\s*=/m, 'globalThis.__lib =')
    // Remove any version query strings from imports (they're not real imports here anyway)
    .replace(/^import\b.*$/gm, '');

try {
    eval(evalSource); // populates globalThis.__lib
} catch (e) {
    console.error('Failed to parse library.js:', e.message);
    process.exit(1);
}

const wordlyLibrary = globalThis.__lib;

// Collect all unique words
const uniqueWords = new Set();
for (const book of Object.values(wordlyLibrary)) {
    for (const chapter of Object.values(book)) {
        for (const entry of chapter) {
            uniqueWords.add(entry.word);
        }
    }
}

const words = [...uniqueWords];
console.log(`Found ${words.length} unique words across all books/lessons.\n`);
console.log('Fetching definitions from FreeDictionaryAPI...\n');

// ── Fetch definitions ─────────────────────────────────────────────────────────

const definitionMap = {};
let found = 0;
let notFound = 0;

for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const def = await fetchDefinition(word);
    definitionMap[word] = def;

    const progress = `[${String(i + 1).padStart(3)}/${words.length}]`;
    if (def) {
        found++;
        const preview = def.length > 70 ? def.substring(0, 70) + '…' : def;
        console.log(`  ${progress} ✓ ${word}: ${preview}`);
    } else {
        notFound++;
        console.log(`  ${progress} ✗ ${word}: (not found in dictionary)`);
    }

    // Polite delay: ~100ms between requests (max ~600/min, well under 1000/hr limit)
    if (i < words.length - 1) await sleep(100);
}

console.log(`\n── Fetch complete: ${found} found, ${notFound} not found out of ${words.length} total ──\n`);

// ── Inject definitions into the source text ───────────────────────────────────
//
// Strategy: for each word, find the exact string pattern:
//   "word": "<word>", "meaning": "<meaning>"
// and replace it with:
//   "word": "<word>", "meaning": "<meaning>", "definition": "<def>"
//
// This is safe because meaning always follows word in the library format.

let updatedSource = rawSource;

// First, strip any previously injected `definition` fields so we don't double-up.
// Match: , "definition": "..." or , "definition": null
updatedSource = updatedSource.replace(/,\s*"definition"\s*:\s*(?:"(?:[^"\\]|\\.)*"|null)/g, '');

// Now inject fresh definitions after each "meaning" value.
for (const [word, definition] of Object.entries(definitionMap)) {
    const defJson = definition ? JSON.stringify(definition) : 'null';

    // Escape the word for safe regex use
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match: "word": "<word>", "meaning": "<any value>"
    // Capture group 1 = everything up to and including the closing quote of meaning value
    const pattern = new RegExp(
        `("word"\\s*:\\s*"${escapedWord}"\\s*,\\s*"meaning"\\s*:\\s*"(?:[^"\\\\]|\\\\.)*")`,
        'g'
    );

    updatedSource = updatedSource.replace(pattern, `$1, "definition": ${defJson}`);
}

// ── Write output ──────────────────────────────────────────────────────────────

fs.writeFileSync(LIBRARY_PATH, updatedSource, 'utf8');

const defCount = (updatedSource.match(/"definition"\s*:/g) || []).length;
console.log(`✅  library.js updated — ${defCount} definition fields written.`);
console.log(`    ${LIBRARY_PATH}\n`);
console.log('Next: run the app and verify definitions appear in quiz feedback.');
