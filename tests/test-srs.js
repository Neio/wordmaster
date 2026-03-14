const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function run() {
    const moduleUrl = pathToFileURL(
        path.resolve(__dirname, '../src/utils/SrsScheduler.js')
    ).href;
    const { computeNextSrs, seedMastered } = await import(moduleUrl);

    const now = 1700000000000;

    // Correct progression: reps 1 -> 2 -> 3 with expected intervals.
    let state = computeNextSrs(null, 5, now);
    assert.strictEqual(state.reps, 1);
    assert.strictEqual(state.intervalDays, 1);
    assert.strictEqual(state.nextDue, now + 86400000);

    state = computeNextSrs(state, 5, now);
    assert.strictEqual(state.reps, 2);
    assert.strictEqual(state.intervalDays, 6);

    state = computeNextSrs(state, 5, now);
    assert.strictEqual(state.reps, 3);
    assert.strictEqual(state.intervalDays, 16);

    // Incorrect reset and ease floor.
    const incorrect = computeNextSrs({ reps: 3, intervalDays: 10, ease: 1.3 }, 2, now);
    assert.strictEqual(incorrect.reps, 0);
    assert.strictEqual(incorrect.intervalDays, 1);
    assert.strictEqual(incorrect.ease, 1.3);

    // Seeding mastered.
    const seeded = seedMastered([{ word: 'alpha', book: 'A', chapter: '1' }], now);
    const entry = seeded['A|1|alpha'];
    assert.strictEqual(entry.reps, 1);
    assert.strictEqual(entry.intervalDays, 1);
    assert.strictEqual(entry.ease, 2.5);
    assert.strictEqual(entry.nextDue, now + 86400000);

    console.log('SRS unit tests passed.');
}

run().catch((err) => {
    console.error('SRS unit tests failed:', err);
    process.exit(1);
});
