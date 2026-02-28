const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8123/');
  await page.waitForTimeout(1000);
  const settingsHtml = await page.evaluate(() => {
     const settingsBtn = document.getElementById('settings-btn');
     if (settingsBtn) settingsBtn.click();
     return document.getElementById('settings-view').outerHTML;
  });
  console.log('SETTINGS HTML:', settingsHtml);
  await browser.close();
  process.exit(0);
})();
