const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8123/');
  await page.waitForTimeout(2000); // give app.js time to execute
  const themeHtml = await page.evaluate(() => document.getElementById('theme-toggle').outerHTML);
  const settingsHtml = await page.evaluate(() => document.getElementById('settings-btn').outerHTML);
  console.log('THEME:', themeHtml);
  console.log('SETTINGS:', settingsHtml);
  
  // also check another icon
  const playHtml = await page.evaluate(() => document.querySelector('[data-lucide="play"]') ? document.querySelector('[data-lucide="play"]').outerHTML : 'no play icon');
  const svgs = await page.evaluate(() => document.querySelectorAll('svg').length);
  console.log('SVGS count:', svgs);

  // simulate click
  await page.evaluate(() => document.getElementById('theme-toggle').click());
  await page.waitForTimeout(500);
  const themeHtml2 = await page.evaluate(() => document.getElementById('theme-toggle').outerHTML);
  const settingsHtml2 = await page.evaluate(() => document.getElementById('settings-btn').outerHTML);
  console.log('AFTER CLICK THEME:', themeHtml2);
  console.log('AFTER CLICK SETTINGS:', settingsHtml2);
  const svgs2 = await page.evaluate(() => document.querySelectorAll('svg').length);
  console.log('AFTER CLICK SVGS count:', svgs2);
  
  await browser.close();
  process.exit(0);
})();
