const { chromium } = require('playwright');
const BASE_URL = 'http://localhost:8000';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ACTUAL REPRODUCTION OF INCORRECT LIST BUG ---');

    // 1. Clear everything
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 2. Paste a custom list and start in "Both" mode
    await page.fill('#word-paste', 'apple: a red fruit');
    await page.click('input[value="both"]');
    await page.click('#start-btn');
    await page.waitForSelector('#quiz-view:not(.hidden)');

    // 3. Answer incorrectly
    await page.fill('#spelling-input', 'wrong');
    await page.click('#check-btn');
    await page.waitForSelector('#next-btn:not(.hidden)');
    await page.click('#next-btn');

    // 4. Wait for results and go back to setup
    await page.waitForSelector('#results-view:not(.hidden)');
    await page.click('#final-restart-btn');
    await page.waitForSelector('#setup-view:not(.hidden)');

    // 5. Check "Review Incorrect" button visibility
    const reviewBtn = page.locator('#review-btn');
    const isVisible = await reviewBtn.isVisible();
    const btnText = await reviewBtn.textContent();

    console.log(`Review Incorrect button visible: ${isVisible}`);
    console.log(`Review Incorrect button text: "${btnText.trim()}"`);

    if (!isVisible || !btnText.includes('(1)')) {
        console.log('❌ BUG REPRODUCED: Review Incorrect list is empty or hidden.');
        await browser.close();
        process.exit(1);
    }

    // 6. VERIFY: Does "apple" appear in review?
    await reviewBtn.click();
    await page.waitForSelector('#quiz-view:not(.hidden)');
    const wordOnScreen = await page.evaluate(() => window.app.words[0].word);
    console.log(`Word in Review Quiz: "${wordOnScreen}"`);

    if (wordOnScreen === 'apple') {
        console.log('✅ PASS: Custom word appeared in Review Incorrect.');
    } else {
        console.log('❌ BUG REPRODUCED: Custom word is missing from Review Quiz.');
    }

    await browser.close();
    process.exit(wordOnScreen === 'apple' ? 0 : 1);
})();
