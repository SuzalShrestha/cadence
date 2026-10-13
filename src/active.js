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
end tell
return n & tab & b & tab & t`;

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
  const [name, bundleId, title] = out.split('\t');
  const s = urlScript(bundleId);
  const url = s ? await osa(s) : null;
  return name ? { name, bundleId, title: title || '', url: url || null } : null;
}

module.exports = { getActiveApp };
