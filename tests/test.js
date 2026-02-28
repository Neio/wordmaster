const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const dom = new JSDOM(`<!DOCTYPE html>
<html>
<body>
    <button id="theme">
        <i data-lucide="sun"></i>
    </button>
    <button id="settings">
        <i data-lucide="settings"></i>
    </button>
    <script src="https://unpkg.com/lucide@latest"></script>
</body>
</html>`, { runScripts: "dangerously", resources: "usable" });

dom.window.onload = () => {
    dom.window.lucide.createIcons();
    console.log("First render:", dom.window.document.body.innerHTML);
    
    // Simulate what app.js does
    const svgs = dom.window.document.querySelectorAll('svg[data-lucide]');
    svgs.forEach(svg => svg.removeAttribute('data-lucide'));
    console.log("After stripping attr:", dom.window.document.body.innerHTML);

    dom.window.lucide.createIcons();
    console.log("After second createIcons:", dom.window.document.body.innerHTML);
};
