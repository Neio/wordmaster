const http = require('http');
const fs = require('fs');
const path = require('path');

http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath == './') filePath = './index.html';
    
    let extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
    }
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(500);
            res.end('Error');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}).listen(8123);
console.log('Server running at http://localhost:8123/');

setTimeout(() => {
    const puppeteer = require('puppeteer');
    (async () => {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.goto('http://localhost:8123/');
      await page.waitForTimeout(2000);
      const settingsHtml = await page.evaluate(() => document.getElementById('settings-btn') ? document.getElementById('settings-btn').outerHTML : 'NOT FOUND');
      const themeHtml = await page.evaluate(() => document.getElementById('theme-toggle') ? document.getElementById('theme-toggle').outerHTML : 'NOT FOUND');
      console.log('SETTINGS BTN:', settingsHtml);
      console.log('THEME BTN:', themeHtml);
      await browser.close();
      process.exit(0);
    })();
}, 1000);
