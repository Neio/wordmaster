const { chromium } = require('playwright');
const BASE_URL = 'http://localhost:8000';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ACTUAL REPRODUCTION OF SRS CUSTOM WORD BUG ---');

    // 1. Clear everything
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 2. Paste a custom list and start in "Both" mode
    await page.fill('#word-paste', 'apple: a red fruit');
    // Select "Both" mode
    await page.click('input[value="both"]');
    await page.click('#start-btn');
    await page.waitForSelector('#quiz-view:not(.hidden)');

    // 3. Answer correctly
    await page.fill('#spelling-input', 'apple');
    await page.fill('#meaning-input', 'a red fruit');
    await page.click('#check-btn');
    await page.waitForSelector('#next-btn:not(.hidden)');
    await page.click('#next-btn');

    // 4. Wait for results and go back
    await page.waitForSelector('#results-view:not(.hidden)');
    await page.click('#final-restart-btn');
    await page.waitForSelector('#setup-view:not(.hidden)');

    // 5. Click "Review" (SRS Review)
    await page.click('#review-due-btn');
    await page.waitForSelector('#review-list-view:not(.hidden)');

    // 6. VERIFY: Does "apple" appear?
    const containerText = await page.locator('#review-words-container').textContent();
    console.log(`SRS Review List Content: "${containerText.trim()}"`);

    if (containerText.includes('apple')) {
        console.log('✅ PASS: Custom word appeared in SRS Review.');
    } else {
        console.log('❌ BUG REPRODUCED: Custom word is missing from SRS Review even after correct answer.');
    }

    await browser.close();
    process.exit(containerText.includes('apple') ? 0 : 1);
})();
