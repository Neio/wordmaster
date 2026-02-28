#!/usr/bin/env node
/**
 * retry-null-definitions.js
 *
 * Retry pass: only fetches words that currently have `"definition": null`.
 * Uses a longer delay to avoid rate-limiting.
 *
 * Usage:
 *   node scripts/retry-null-definitions.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY_PATH = path.join(__dirname, '..', 'src', 'data', 'library.js');
const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

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

const rawSource = fs.readFileSync(LIBRARY_PATH, 'utf8');

// Find all words that currently have null definitions
const nullPattern = /"word"\s*:\s*"([^"]+)"[^}]*?"definition"\s*:\s*null/g;
const nullWords = [];
let m;
while ((m = nullPattern.exec(rawSource)) !== null) {
    nullWords.push(m[1]);
}

const uniqueNullWords = [...new Set(nullWords)];
console.log(`Found ${uniqueNullWords.length} words with null definitions. Retrying...\n`);

let found = 0;
let stillNotFound = 0;
const newDefs = {};

for (let i = 0; i < uniqueNullWords.length; i++) {
    const word = uniqueNullWords[i];
    const def = await fetchDefinition(word);
    newDefs[word] = def;

    const progress = `[${String(i + 1).padStart(3)}/${uniqueNullWords.length}]`;
    if (def) {
        found++;
        const preview = def.length > 70 ? def.substring(0, 70) + '…' : def;
        console.log(`  ${progress} ✓ ${word}: ${preview}`);
    } else {
        stillNotFound++;
        console.log(`  ${progress} ✗ ${word}`);
    }

    if (i < uniqueNullWords.length - 1) await sleep(200); // 200ms = 300 req/min max, well within limits
}

console.log(`\nRetry complete: ${found} newly resolved, ${stillNotFound} still not found.\n`);

// Inject newly found definitions into source
let updated = rawSource;
for (const [word, def] of Object.entries(newDefs)) {
    if (!def) continue; // keep null for words still not found
    const defJson = JSON.stringify(def);

    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace `"definition": null` specifically for this word's entry
    const objectPattern = new RegExp(
        `("word"\\s*:\\s*"${escapedWord}"[^}]*?)"definition"\\s*:\\s*null`,
        'g'
    );
    updated = updated.replace(objectPattern, `$1"definition": ${defJson}`);
}

fs.writeFileSync(LIBRARY_PATH, updated, 'utf8');

const totalDefs = (updated.match(/"definition"\s*:\s*"[^"]/g) || []).length;
const totalNull = (updated.match(/"definition"\s*:\s*null/g) || []).length;
console.log(`✅ Done. ${totalDefs} real definitions, ${totalNull} still null in library.js`);
