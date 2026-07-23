/* harness.js — boots the real Dō app inside jsdom and runs probe code that can
 * see the app's `let` globals.
 *
 * Two details that matter:
 *  - index.html references app.config.js; some checkouts use app_config.js,
 *    so each src falls back to the underscore variant if the dot name is absent.
 *  - Every file plus the probe is concatenated into ONE eval. Classic <script>
 *    tags share a single global lexical environment, so `let tasks` in
 *    app_config.js is visible to every later file. Separate eval() calls each
 *    get their own lexical scope, and the globals would be invisible.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');

function scriptFiles() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  // index.html says app.render.js. Some checkouts name the file app_render.js.
  // Accept whichever actually exists so the suite runs either way.
  return srcs.map((src) => {
    if (fs.existsSync(path.join(ROOT, src))) return src;
    const alt = src.replace(/\.js$/, '').replace(/\./g, '_') + '.js';
    if (fs.existsSync(path.join(ROOT, alt))) return alt;
    throw new Error(`Script from index.html not found: ${src} (also tried ${alt})`);
  });
}

// Boot the app, then run `probe` in the same scope. Probe assigns to __out.
function run(probe = '') {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'https://example.test/',
    pretendToBeVisual: true,
  });
  const win = dom.window;

  win.fetch = () => new Promise(() => {});
  win.__alerts = [];
  win.alert = (m) => { win.__alerts.push(String(m)); };
  win.confirm = () => true;
  win.__out = {};
  if (!win.navigator.serviceWorker) {
    Object.defineProperty(win.navigator, 'serviceWorker', {
      value: { register: () => Promise.resolve() }, configurable: true,
    });
  }

  const bundle = scriptFiles()
    .map((f) => `\n//# ---- ${f} ----\n` + fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n');

  win.eval(bundle + '\n;(function(){\n' + probe + '\n})();');
  return { win, dom, out: win.__out };
}

module.exports = { run, scriptFiles, ROOT };
