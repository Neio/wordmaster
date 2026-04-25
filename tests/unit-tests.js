import { JSDOM } from 'jsdom';

// 1. Setup JSDOM environment for browser-specific globals
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

// 2. Mock Web Audio API and Audio object (since they're not in JSDOM)
class MockAudio {
    constructor(src) {
        this.src = src;
        this.currentTime = 0;
    }
    play() { return Promise.resolve(); }
    pause() {}
}
global.window.Audio = MockAudio;
global.Audio = MockAudio;

class MockAudioContext {
    constructor() {
        this.state = 'running';
        this.currentTime = 0;
    }
    resume() { return Promise.resolve(); }
    createOscillator() {
        return {
            type: 'sine',
            frequency: { 
                setValueAtTime: () => {}, 
                exponentialRampToValueAtTime: () => {} 
            },
            connect: () => {},
            start: () => {},
            stop: () => {}
        };
    }
    createGain() {
        return {
            gain: { 
                setValueAtTime: () => {}, 
                linearRampToValueAtTime: () => {},
                exponentialRampToValueAtTime: () => {} 
            },
            connect: () => {}
        };
    }
    get destination() { return {}; }
}
global.window.AudioContext = MockAudioContext;
global.window.webkitAudioContext = MockAudioContext;

// 3. Import the modules to test using dynamic import to ensure globals are set first
const { verifySpelling, isMeaningCorrect } = await import('../src/utils/VerificationLogic.js');
const { computeNextSrs } = await import('../src/utils/SrsScheduler.js');
const { soundEffects } = await import('../src/utils/SoundEffects.js');

let failed = 0;
function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        failed++;
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

console.log("--- Testing VerificationLogic ---");
assert(verifySpelling("apple", "Apple"), "Spelling should be case-insensitive");
assert(verifySpelling("  apple  ", "apple"), "Spelling should ignore surrounding whitespace");
assert(isMeaningCorrect("round red fruit", "a round red fruit"), "Meaning should match if similarity is high");
assert(!isMeaningCorrect("banana", "apple"), "Meaning should not match for unrelated words");

console.log("\n--- Testing SrsScheduler ---");
const now = Date.now();
// Initial review
const next = computeNextSrs(null, 5, now);
assert(next.reps === 1, "First correct answer sets reps to 1");
assert(next.intervalDays === 1, "First correct answer sets interval to 1 day");

// Second review
const next2 = computeNextSrs(next, 5, now + 1000);
assert(next2.reps === 2, "Second correct answer sets reps to 2");
assert(next2.intervalDays === 6, "Second correct answer sets interval to 6 days");

// Failure review
const failedSrs = computeNextSrs(next2, 2, now + 2000);
assert(failedSrs.reps === 0, "Failure resets reps to 0");
assert(failedSrs.intervalDays === 1, "Failure sets interval to 1 day");

console.log("\n--- Testing SoundEffects (Mocked) ---");
try {
    soundEffects.playSuccess();
    assert(true, "playSuccess should execute without errors in mocked environment");
    soundEffects.playFailure();
    assert(true, "playFailure should execute without errors in mocked environment");
} catch (e) {
    assert(false, `SoundEffects execution failed: ${e.message}`);
}

if (failed > 0) {
    console.log(`\nTests finished with ${failed} failures.`);
    process.exit(1);
} else {
    console.log("\nAll unit tests passed! ✨");
    process.exit(0);
}
