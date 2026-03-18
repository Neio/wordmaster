const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function run() {
    const moduleUrl = pathToFileURL(
        path.resolve(__dirname, '../src/utils/SrsScheduler.js')
    ).href;
    const { computeNextSrs, seedMastered } = await import(moduleUrl);

    const DAY = 86400000;
    let now = 1700000000000;

    // Correct progression: reps 1 -> 2 -> 3 with expected intervals.
    // We increment 'now' to avoid "early review" logic for the standard progression test.
    
    // Rep 1
    let state = computeNextSrs(null, 5, now);
    assert.strictEqual(state.reps, 1);
    assert.strictEqual(state.intervalDays, 1);
    
    // Rep 2 (wait 1 day)
    now += 1 * DAY;
    state = computeNextSrs(state, 5, now);
    assert.strictEqual(state.reps, 2);
    assert.strictEqual(state.intervalDays, 6);

    // Rep 3 (wait 6 days)
    now += 6 * DAY;
    state = computeNextSrs(state, 5, now);
    assert.strictEqual(state.reps, 3);
    assert.strictEqual(state.intervalDays, 16);

    // Incorrect reset and ease floor.
    const incorrect = computeNextSrs({ reps: 3, intervalDays: 10, ease: 1.3 }, 2, now);
    assert.strictEqual(incorrect.reps, 0);
    assert.strictEqual(incorrect.intervalDays, 1);
    assert.strictEqual(incorrect.ease, 1.3);

    // Early Review Logic Tests (reps >= 3 scenario)
    const longState = {
        reps: 3,
        intervalDays: 10,
        ease: 2.5,
        lastReviewed: now, 
        nextDue: now + (10 * DAY)
    };

    // 1. Very early correct review (Day 2 of 10)
    const veryEarlyNow = now + (2 * DAY); 
    const veryEarly = computeNextSrs(longState, 5, veryEarlyNow);
    // elapsed (2) * ease (2.5) = 5. max(10, 5) = 10.
    assert.strictEqual(veryEarly.intervalDays, 10);
    assert.strictEqual(veryEarly.reps, 4);

    // 2. Partially early correct review (Day 8 of 10)
    const partialEarlyNow = now + (8 * DAY);
    const partialEarly = computeNextSrs(longState, 5, partialEarlyNow);
    // elapsed (8) * ease (2.5) = 20. max(10, 20) = 20.
    assert.strictEqual(partialEarly.intervalDays, 20);

    // 3. Early incorrect review (should still reset)
    const earlyFail = computeNextSrs(longState, 2, veryEarlyNow);
    assert.strictEqual(earlyFail.intervalDays, 1);
    assert.strictEqual(earlyFail.reps, 0);

    // Seeding mastered.
    const seeded = seedMastered([{ word: 'alpha', book: 'A', chapter: '1' }], now);
    const entry = seeded['A|1|alpha'];
    assert.strictEqual(entry.reps, 1);
    assert.strictEqual(entry.intervalDays, 1);
    assert.strictEqual(entry.ease, 2.5);
    assert.strictEqual(entry.nextDue, now + DAY);

    console.log('SRS unit tests passed.');
}

run().catch((err) => {
    console.error('SRS unit tests failed:', err);
    process.exit(1);
});
