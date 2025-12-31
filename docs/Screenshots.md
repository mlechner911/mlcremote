**Fancy Screenshots Guide**

This project ships a small HTML/CSS screenshot template that creates a polished 3D card-style preview of the app UI. You can either drop a screenshot into the template and capture it with your preferred tool, or use the included Node script to render it headlessly via Puppeteer.

Files added:
- `docs/screenshot-template.html` — a responsive HTML template with a subtle 3D card effect and drop shadow. Drop your app screenshot into the `img` tag with id `app-snap`.
- `docs/render-screenshot.js` — optional script that uses Puppeteer to render the template to PNG. Install `npm i puppeteer` to use it.

Quick steps (manual):
1. Capture a regular screenshot of the app (e.g. dev server app at localhost:5179) and save it as `docs/snap.png`.
2. Edit `docs/screenshot-template.html` and set the `src` of `#app-snap` to `snap.png` (default already points there).
3. Open `docs/screenshot-template.html` in a browser and use your OS screenshot tool to crop/save, or use the provided script.

Quick steps (automated render):
1. Install Puppeteer:
```bash
cd frontend
npm install puppeteer --save-dev
```
2. Run the render script from repo root:
```bash
node docs/render-screenshot.js --output docs/fancy-screenshot.png
```

If you'd like more templates (dark mode, device frames, different angles), tell me which styles you prefer and I will add variants.
