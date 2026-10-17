// Frontmost app, window title and browser URL on macOS, via osascript.
// Rize uses a native addon (@rize-io/get-windows); AppleScript gives the same fields with no dependency.
// ponytail: macOS only; add a Windows reader when that platform matters.
const { execFile } = require('node:child_process');

const FRONT = `
tell application "System Events"
  set p to first application process whose frontmost is true
  set n to name of p
  set b to bundle identifier of p
  try
    set t to name of front window of p
  on error
    set t to ""
  end try
  -- AXDocument: the open file (editors, Preview, Office), the working folder (terminals) or the page (some browsers).
  try
    set d to value of attribute "AXDocument" of front window of p
    if d is missing value then set d to ""
  on error
    set d to ""
  end try
end tell
return n & tab & b & tab & t & tab & d`;

// Browser terminology must be literal at compile time, so the URL needs a second call.
const CHROMIUM = ['com.google.Chrome', 'com.brave.Browser', 'com.microsoft.edgemac', 'company.thebrowser.Browser', 'com.vivaldi.Vivaldi'];
const urlScript = (id) =>
  id === 'com.apple.Safari' ? 'tell application id "com.apple.Safari" to get URL of current tab of front window'
  : CHROMIUM.includes(id) ? `tell application id "${id}" to get URL of active tab of front window`
  : null;

const osa = (script) => new Promise((resolve) =>
  execFile('osascript', ['-e', script], { timeout: 5000 }, (err, out, stderr) => {
    if (err) console.error('[ActiveApp]', stderr.trim() || err.message);
    resolve(err ? null : out.replace(/\n$/, ''));
  }));

async function getActiveApp() {
  const out = await osa(FRONT);
  if (!out) return null;
  const [name, bundleId, title, doc] = splitFront(out);
  const s = urlScript(bundleId);
  const { path, url: docUrl } = parseDoc(doc);
  const url = (s ? await osa(s) : null) || docUrl;
  return name ? { name, bundleId, title: title || '', url: url || null, path } : null;
}

// App name and bundle id hold no tabs, and AXDocument is a URL (a tab would be %09). A title can hold tabs,
// so it is everything between field 2 and the last field. A title cannot fake the document path.
function splitFront(out) {
  const p = out.split('\t');
  return p.length < 4 ? [p[0], p[1], p.slice(2).join('\t'), ''] : [p[0], p[1], p.slice(2, -1).join('\t'), p.at(-1)];
}

// AXDocument is a file:// or http(s):// URL string.
function parseDoc(doc) {
  if (!doc) return { path: null, url: null };
  if (/^https?:/i.test(doc)) return { path: null, url: doc };
  try { return { path: require('node:url').fileURLToPath(doc).replace(/(.)\/$/, '$1'), url: null }; } catch { return { path: null, url: null }; }
}

module.exports = { getActiveApp, parseDoc, splitFront };
