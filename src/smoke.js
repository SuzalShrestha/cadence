// CADENCE_SMOKE=<dir>: render every page and window, save PNGs to <dir>, print renderer errors, quit.
// Use it with CADENCE_DATA pointing at a scratch data folder. It briefly shows the full-screen overlays.
const fs = require('node:fs');
const path = require('node:path');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = ({ app, api, getWindow, startSession, showToast, showOverlays, toggleQuick }) => {
  process.on('uncaughtException', (e) => errors.push(`main: ${e.stack}`)); // no blocking dialog
  const dir = process.env.CADENCE_SMOKE;
  fs.mkdirSync(dir, { recursive: true });
  const errors = [];
  const listen = (wc) => wc.on('console-message', (e) => { if (e.level === 'error') errors.push(`${e.message} (${path.basename(e.sourceId || '')}:${e.lineNumber})`); });
  app.on('web-contents-created', (_e, wc) => listen(wc));
  const shot = async (name, win) => {
    if (!win || win.isDestroyed()) return console.log('SMOKE missing window', name);
    // Wait for two painted frames so the capture is not the previous page.
    await Promise.race([win.webContents.executeJavaScript('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'), wait(1500)]);
    win.webContents.invalidate(); await wait(250);
    await win.webContents.capturePage(); await wait(250); // Electron 44 can return the last cached frame once
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(dir, `${name}.png`), img.toPNG());
    console.log('SMOKE shot', name, img.getSize());
  };
  const js = (code) => getWindow('dashboard').webContents.executeJavaScript(code);

  (async () => {
    await wait(2500);
    const dash = getWindow('dashboard');
    listen(dash.webContents);
    dash.webContents.reload(); await wait(2000); // catch load-time errors too
    const day = process.env.CADENCE_SMOKE_DAY;
    const pages = [
      ['home-day', `localStorage.setItem('home.view','day'); location.hash = '${day ? `home/${day}` : 'home'}';`],
      ['home-week', "localStorage.setItem('home.view','week'); location.hash = 'timer'; setTimeout(() => location.hash = 'home', 50);"],
      ['home-month', "localStorage.setItem('home.view','month'); location.hash = 'timer'; setTimeout(() => location.hash = 'home', 50);"],
      ['timer', "localStorage.setItem('home.view','day'); location.hash = 'timer';"],
      ['activity', "location.hash = 'activity';"],
      ['entries', "location.hash = 'entries';"],
      ['reports', "location.hash = 'reports';"],
      ['productivity', "location.hash = 'productivity';"],
      ['projects', "location.hash = 'projects';"],
      ['clients', "location.hash = 'clients';"],
      ['tasks', "location.hash = 'tasks';"],
      ['settings', "location.hash = 'settings/general';"],
      ['settings-blocker', "location.hash = 'settings/blocker';"],
      ['settings-rules', "location.hash = 'settings/rules';"],
      ['settings-hours', "location.hash = 'settings/hours';"],
    ];
    for (const [name, code] of pages) { await js(code); await wait(1100); await shot(name, dash); }

    // Entry popover on the first time entry, if any.
    await js(`localStorage.setItem('home.view','day'); location.hash = '${day ? `home/${day}` : 'home'}';`); await wait(1200);
    const hasEntry = await js(`(() => { const b = document.querySelector('.blk[data-entry]'); if (!b) return false; b.scrollIntoView({block:'center'}); b.click(); return true; })()`);
    if (hasEntry) { await wait(900); await shot('home-popover', dash); }

    // Light theme.
    const before = api.state().settings.theme;
    api.saveSettings({ theme: 'light' }); await wait(1400); await shot('home-light', dash);
    await js("location.hash = 'reports';"); await wait(1100); await shot('reports-light', dash);
    api.saveSettings({ theme: before }); await wait(600);

    // Small windows.
    await shot('widget', getWindow('widget'));
    toggleQuick(); await wait(1400); await shot('quick', getWindow('quick'));
    getWindow('quick')?.hide();
    showToast({ kind: 'day', key: api.state().todayKey }); await wait(1400); await shot('toast-day', getWindow('toast'));
    const last = api.list('sessions').filter((s) => s.type === 'focus').at(-1);
    if (last) { showToast({ kind: 'session', id: last.id }); await wait(1400); await shot('toast-session', getWindow('toast')); }
    api.closeToast();
    startSession('focus', { title: 'Write the quarterly plan' });
    showOverlays('block', { name: 'YouTube', category: 'entertainment', hostKey: 'youtube.com' }); await wait(1500); await shot('overlay-block', getWindow('overlay'));
    await js("location.hash = 'timer';"); api.overlay('thanks'); await wait(1100); await shot('timer-live', dash);
    startSession('break'); await wait(1500); await shot('overlay-break', getWindow('overlay'));
    api.stopSession();

    console.log(errors.length ? `SMOKE renderer errors:\n  ${[...new Set(errors)].join('\n  ')}` : 'SMOKE renderer errors: none');
    app.quit();
  })().catch((e) => { console.error('SMOKE failed', e); app.exit(1); });
};
