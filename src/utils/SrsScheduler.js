const DAY_MS = 24 * 60 * 60 * 1000;

const clampEase = (ease) => Math.max(1.3, ease);

export const makeSrsKey = (book, chapter, word) => `${book}|${chapter}|${word}`;

export const computeNextSrs = (state, quality, nowMs) => {
    const prev = state || {};
    const prevReps = Number.isFinite(prev.reps) ? prev.reps : 0;
    const prevInterval = Number.isFinite(prev.intervalDays) ? prev.intervalDays : 0;
    const prevEase = Number.isFinite(prev.ease) ? prev.ease : 2.5;

    const q = Math.max(0, Math.min(5, quality));
    const ease = clampEase(
        prevEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    );

    let reps = prevReps;
    let intervalDays = prevInterval;

    if (q < 3) {
        reps = 0;
        intervalDays = 1;
    } else {
        reps = prevReps + 1;
        if (reps === 1) {
            intervalDays = 1;
        } else if (reps === 2) {
            intervalDays = 6;
        } else {
            intervalDays = Math.round(prevInterval * ease);
        }
    }

    const nextDue = nowMs + intervalDays * DAY_MS;

    return {
        reps,
        intervalDays,
        ease,
        lastReviewed: nowMs,
        nextDue
    };
};

export const seedMastered = (entries, nowMs) => {
    const seeded = {};
    for (const entry of entries) {
        const key = makeSrsKey(entry.book, entry.chapter, entry.word);
        seeded[key] = {
            reps: 1,
            intervalDays: 1,
            ease: 2.5,
            lastReviewed: nowMs,
            nextDue: nowMs + DAY_MS
        };
    }
    return seeded;
};
