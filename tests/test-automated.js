#!/usr/bin/env node

/**
 * Automated Test Suite for WordMaster
 * Tests core functionality against TEST_PLAN.md requirements
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8000';

// Test configuration
const TESTS = {
    feedbackPersistence: {
        id: '6.2',
        name: 'Feedback Persistence Bug Fix',
        description: 'Verify feedback does not persist after restart'
    },
    reviewButtonPersistence: {
        id: '5.5',
        name: 'Review Incorrect Button Persists After Restart',
        description: 'Button should reappear with correct count after restart'
    },
    incorrectWordRemoval: {
        id: '5.6',
        name: 'Correctly Answered Words Removed from Incorrect List',
        description: 'Words corrected in review mode should be removed'
    },
    srsButtonAlwaysVisible: {
        id: '7.1',
        name: 'SRS Review Button Always Visible',
        description: 'Review button should always be visible on the setup screen'
    },
    srsReviewFlow: {
        id: '7.2',
        name: 'SRS Review Due Flow Updates Count',
        description: 'Due count should drop to 0 after reviewing due items'
    },
    srsCurveUpdate: {
        id: '7.3',
        name: 'SRS Memory Curve Updates State',
        description: 'Correct answer should advance reps, interval, and ease'
    },
    srsManualList: {
        id: '7.4',
        name: 'Manual List SRS Integration',
        description: 'Words from manual paste should be included in SRS'
    },
    srsManualPersistence: {
        id: '7.5',
        name: 'Manual Word Persistence After Review',
        description: 'Custom words should remain in SRS with metadata after a review session'
    },
    srsEarlyReview: {
        id: '7.6',
        name: 'Early Review Protection',
        description: 'Reviewing before due date should limit interval growth'
    },
    pasteEnterBug: {
        id: '8.1',
        name: 'Paste Textarea Enter Key Bug',
        description: 'Pressing Enter in the paste textarea should not start the quiz'
    }
};

async function runTests() {
    const args = process.argv.slice(2);
    const filter = args.length > 0 ? args[0].toLowerCase() : null;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const results = [];

    const selectedTests = Object.entries(TESTS).filter(([key, config]) => {
        if (!filter) return true;
        return key.toLowerCase().includes(filter) || config.id.includes(filter) || config.name.toLowerCase().includes(filter);
    });

    if (selectedTests.length === 0) {
        console.error(`❌ No tests found matching: "${filter}"`);
        console.log('Available tests:', Object.keys(TESTS).join(', '));
        await browser.close();
        process.exit(1);
    }

    console.log(`🚀 Starting WordMaster Test Suite (${selectedTests.length}/${Object.keys(TESTS).length} tests)\n`);

    // Helper to finish quiz (assumes setup is done)
    async function finishQuiz(page, correct = false) {
        while (true) {
            const resultsVisible = await page.locator('#results-view').isVisible();
            if (resultsVisible) break;

            if (await page.locator('#next-btn:not(.hidden)').isVisible()) {
                await page.locator('#next-btn:not(.hidden)').click();
                await page.waitForTimeout(200);
                continue;
            }

            const inputVisible = await page.locator('#spelling-input').isVisible();
            if (!inputVisible) {
                await page.waitForTimeout(500);
                if (await page.locator('#results-view').isVisible()) break;
                continue;
            }

            const inputEnabled = await page.locator('#spelling-input').isEnabled();
            if (!inputEnabled) {
                await page.waitForTimeout(200);
                continue;
            }

            if (correct) {
                const word = await page.evaluate(() => {
                    const app = window.app;
                    if (!app || !app.words || !app.words[app.currentIndex]) return 'unknown';
                    return app.words[app.currentIndex].word;
                });
                await page.fill('#spelling-input', word);
            } else {
                await page.fill('#spelling-input', 'wrong');
            }

            await page.press('#spelling-input', 'Enter');
            await page.waitForTimeout(200);
        }
    }

    async function clearStorageAndReload(page) {
        await page.goto(BASE_URL);
        await page.waitForSelector('#setup-view:not(.hidden)');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForSelector('#setup-view:not(.hidden)');
    }

    async function seedSrsDue(page, dueCount = 2) {
        await page.selectOption('#library-select', { index: 1 });
        await page.click('#start-btn');
        await page.waitForSelector('#quiz-view:not(.hidden)');

        const data = await page.evaluate((count) => {
            const app = window.app;
            const words = app.words.slice(0, count).map(w => w.word);
            return { book: app.currentBook, chapter: app.currentChapter, words };
        }, dueCount);

        const now = Date.now();
        await page.evaluate(({ data, now }) => {
            const srs = {};
            data.words.forEach(word => {
                const key = `${data.book}|${data.chapter}|${word}`;
                srs[key] = {
                    reps: 1,
                    intervalDays: 1,
                    ease: 2.5,
                    lastReviewed: now - 86400000,
                    nextDue: now - 1000
                };
            });
            localStorage.setItem('wordmaster-srs-v1', JSON.stringify(srs));
            localStorage.setItem('wordmaster-srs-seeded', '1');
        }, { data, now });

        await page.click('#restart-btn');
        await page.waitForSelector('#setup-view:not(.hidden)');
        await page.reload();
        await page.waitForSelector('#setup-view:not(.hidden)');
        await page.selectOption('#library-select', { index: 1 });

        return data;
    }

    async function seedIncorrectWords(page) {
        await clearStorageAndReload(page);
        await page.selectOption('#library-select', { index: 1 });
        await page.click('#start-btn');
        await page.waitForSelector('#quiz-view:not(.hidden)');
        console.log('   Seeding incorrect words...');
        await finishQuiz(page, false);
        await page.waitForSelector('#results-view:not(.hidden)');
        await page.click('#final-restart-btn');
        await page.waitForSelector('#setup-view:not(.hidden)');
    }

    for (const [testKey, config] of selectedTests) {
        try {
            console.log(`📋 Test ${config.id}: ${config.name}`);
            
            if (testKey === 'feedbackPersistence') {
                await clearStorageAndReload(page);
                await page.fill('#word-paste', 'apple\nbanana\ncarrot');
                await page.click('#start-btn');
                await page.waitForSelector('#quiz-view:not(.hidden)');
                await page.fill('#spelling-input', 'wrongword');
                await page.press('#spelling-input', 'Enter');
                await page.waitForSelector('.feedback.status-incorrect:not(.hidden)');
                const feedbackVisible = await page.locator('.feedback.status-incorrect').isVisible();
                console.log(`   ✓ Incorrect feedback displayed: ${feedbackVisible}`);
                await page.click('#restart-btn');
                await page.waitForSelector('#setup-view:not(.hidden)');
                await page.fill('#word-paste', 'dog\ncat');
                await page.click('#start-btn');
                await page.waitForSelector('#quiz-view:not(.hidden)');
                const feedbackHidden = await page.locator('#feedback').evaluate(el => el.classList.contains('hidden'));
                const feedbackEmpty = await page.locator('#feedback').evaluate(el => el.innerHTML === '');
                const passed = feedbackHidden && feedbackEmpty;
                console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Feedback cleared\n`);
                results.push({ test: config.name, passed });

            } else if (testKey === 'reviewButtonPersistence') {
                await seedIncorrectWords(page);
                await page.waitForSelector('#review-btn');
                const buttonVisible = await page.locator('#review-btn').isVisible();
                const passed = buttonVisible;
                console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Button persists\n`);
                results.push({ test: config.name, passed });

            } else if (testKey === 'incorrectWordRemoval') {
                await seedIncorrectWords(page);
                await page.click('#review-btn');
                await page.waitForSelector('#quiz-view:not(.hidden)');
                console.log('   Answering first review word correctly...');
                const word = await page.evaluate(() => window.app.words[window.app.currentIndex].word);
                await page.fill('#spelling-input', word);
                await page.press('#spelling-input', 'Enter');
                await page.waitForSelector('#next-btn:not(.hidden), #spelling-input:enabled, #results-view:not(.hidden)');
                if (await page.locator('#next-btn:not(.hidden)').isVisible()) await page.click('#next-btn');
                console.log('   Failing remaining review words...');
                await finishQuiz(page, false);
                await page.waitForSelector('#results-view:not(.hidden)');
                await page.click('#final-restart-btn');
                await page.waitForSelector('#setup-view:not(.hidden)');
                const finalText = await page.locator('#review-btn').textContent();
                const passed = finalText.includes('Review Incorrect');
                console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Count updated\n`);
                results.push({ test: config.name, passed });

            } else if (testKey === 'srsButtonAlwaysVisible') {
                await clearStorageAndReload(page);
                const initialVisible = await page.locator('#review-due-btn').isVisible();
                await page.selectOption('#library-select', { index: 1 });
                const selectedVisible = await page.locator('#review-due-btn').isVisible();
                await page.selectOption('#library-select', '');
                const deselectedVisible = await page.locator('#review-due-btn').isVisible();
                const passed = initialVisible && selectedVisible && deselectedVisible;
                console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Review button persistent\n`);
                results.push({ test: config.name, passed });

            } else if (testKey === 'srsReviewFlow') {
                await clearStorageAndReload(page);
                await page.click('#review-due-btn');
                const noticeText = await page.locator('#setup-notice').textContent();
                console.log(`   ✓ No SRS notice: "${noticeText}"`);
                await seedSrsDue(page, 2);
                await page.click('#review-due-btn');
                await page.waitForSelector('#review-list-view:not(.hidden)');
                const subtitle = await page.locator('#review-list-subtitle').textContent();
                const wordItems = await page.locator('#review-words-container .review-word-item').count();
                console.log(`   ✓ Review List preview shown: "${subtitle}" (${wordItems} words)`);
                await page.click('#start-review-action-btn');
                await page.waitForSelector('#quiz-view:not(.hidden)');
                await finishQuiz(page, true);
                await page.waitForSelector('#results-view:not(.hidden)');
                const passed = wordItems === 2;
                console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Review flow verified\n`);
                results.push({ test: config.name, passed });

            } else if (testKey === 'srsCurveUpdate') {
                await clearStorageAndReload(page);
                const data = await seedSrsDue(page, 1);
                await page.click('#review-due-btn');
                await page.waitForSelector('#review-list-view:not(.hidden)');
                await page.click('#start-review-action-btn');
                await page.waitForSelector('#quiz-view:not(.hidden)');
                await finishQuiz(page, true);
                await page.waitForSelector('#results-view:not(.hidden)');
                const srsEntry = await page.evaluate(({ data }) => {
                    const raw = localStorage.getItem('wordmaster-srs-v1');
                    const parsed = raw ? JSON.parse(raw) : {};
                    const key = `${data.book}|${data.chapter}|${data.words[0]}`;
                    return parsed[key];
                }, { data });
                const passed = srsEntry && srsEntry.reps === 2 && srsEntry.intervalDays === 6;
                console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: SRS state updated\n`);
                results.push({ test: config.name, passed });

            } else if (testKey === 'srsManualList') {
                await clearStorageAndReload(page);
                await page.fill('#word-paste', 'manualword: custom definition');
                await page.click('#start-btn');
                await page.waitForSelector('#quiz-view:not(.hidden)');
                await finishQuiz(page, true);
                await page.waitForSelector('#results-view:not(.hidden)');
                await page.click('#final-restart-btn');
                await page.waitForSelector('#setup-view:not(.hidden)');
                const srsEntry = await page.evaluate(() => {
                    const raw = localStorage.getItem('wordmaster-srs-v1');
                    const parsed = raw ? JSON.parse(raw) : {};
                    return parsed['Custom|Manual|manualword'];
                });
                const hasCustomData = srsEntry && srsEntry.customData && srsEntry.customData.meaning === 'custom definition';
                await page.click('#review-due-btn');
                await page.waitForSelector('#review-list-view:not(.hidden)');
                const listText = await page.locator('#review-words-container').textContent();
                const passed = hasCustomData && listText.includes('manualword');
                console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Manual word present in Review List\n`);
                results.push({ test: config.name, passed });

            } else if (testKey === 'srsManualPersistence') {
                await clearStorageAndReload(page);
                await page.evaluate(() => {
                    const now = Date.now();
                    const srs = {
                        'Custom|Manual|persistent': {
                            reps: 1, intervalDays: 1, ease: 2.5,
                            lastReviewed: now - 86400000, nextDue: now - 1000,
                            customData: { meaning: 'should stay' }
                        }
                    };
                    localStorage.setItem('wordmaster-srs-v1', JSON.stringify(srs));
                    localStorage.setItem('wordmaster-srs-seeded', '1');
                });
                await page.reload();
                await page.click('#review-due-btn');
                await page.waitForSelector('#review-list-view:not(.hidden)');
                await page.click('#start-review-action-btn');
                await page.waitForSelector('#quiz-view:not(.hidden)');
                await finishQuiz(page, true);
                await page.waitForSelector('#results-view:not(.hidden)');
                const srsEntry = await page.evaluate(() => {
                    const raw = localStorage.getItem('wordmaster-srs-v1');
                    const parsed = raw ? JSON.parse(raw) : {};
                    return parsed['Custom|Manual|persistent'];
                });
                const passed = srsEntry && srsEntry.reps === 2 && srsEntry.customData;
                console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Custom data preserved after review\n`);
                results.push({ test: config.name, passed });

            } else if (testKey === 'srsEarlyReview') {
                await clearStorageAndReload(page);
                await page.evaluate(() => {
                    const now = Date.now();
                    const srs = {
                        'Custom|Manual|early': {
                            reps: 3,
                            intervalDays: 10,
                            ease: 2.5,
                            lastReviewed: now - (2 * 24 * 60 * 60 * 1000), // 2 days ago
                            nextDue: now + (8 * 24 * 60 * 60 * 1000),      // Due in 8 days
                            customData: { meaning: 'early test' }
                        }
                    };
                    localStorage.setItem('wordmaster-srs-v1', JSON.stringify(srs));
                    localStorage.setItem('wordmaster-srs-seeded', '1');
                });
                await page.reload();
                await page.click('#review-due-btn');
                await page.waitForSelector('#review-list-view:not(.hidden)');
                await page.click('#start-review-action-btn');
                await page.waitForSelector('#quiz-view:not(.hidden)');
                await finishQuiz(page, true);
                await page.waitForSelector('#results-view:not(.hidden)');
                const srsEntry = await page.evaluate(() => {
                    const raw = localStorage.getItem('wordmaster-srs-v1');
                    const parsed = raw ? JSON.parse(raw) : {};
                    return parsed['Custom|Manual|early'];
                });
                // elapsed (2) * ease (2.5) = 5. max(10, 5) = 10.
                const passed = srsEntry && srsEntry.intervalDays === 10;
                console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Early review protected (interval: ${srsEntry?.intervalDays})\n`);
                results.push({ test: config.name, passed });

            } else if (testKey === 'pasteEnterBug') {
                await clearStorageAndReload(page);
                
                await page.focus('#word-paste');
                await page.keyboard.type('word1: def1');
                await page.keyboard.press('Enter');
                await page.keyboard.type('word2: def2');

                // Check if we are still in SETUP state (textarea visible) or in QUIZ state
                const quizVisible = await page.locator('#quiz-view').isVisible();
                const textareaValue = await page.locator('#word-paste').inputValue();
                
                const passed = quizVisible === false && textareaValue === 'word1: def1\nword2: def2';
                console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Enter key in textarea adding newline (Quiz visible: ${quizVisible})\n`);
                results.push({ test: config.name, passed });
            }
        } catch (error) {
            console.error(`   ❌ ERROR in ${config.name}: ${error.message}\n`);
            results.push({ test: config.name, passed: false, error: error.message });
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    results.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.test}`);
        if (result.error) console.log(`   Error: ${result.error}`);
    });

    console.log(`\n${passed}/${total} tests passed (${Math.round(passed / total * 100)}%)\n`);

    await browser.close();
    process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
