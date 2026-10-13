import { api, esc, icon, clock, nowS, $, setClock24, SESSION } from './lib.js';

const NAV = [
  ['Track', [['home', 'house', 'Home'], ['timer', 'timer', 'Timer'], ['activity', 'activity', 'Activity']]],
  ['Insights', [['entries', 'list', 'Time Entries'], ['reports', 'chart-column', 'Reports'], ['productivity', 'trending-up', 'Productivity']]],
  ['Work', [['projects', 'box', 'Projects'], ['clients', 'building-2', 'Clients'], ['tasks', 'square-check-big', 'Tasks']]],
];
const PAGES = {
  home: () => import('./pages/home.js'), timer: () => import('./pages/timer.js'), activity: () => import('./pages/activity.js'),
  entries: () => import('./pages/entries.js'), reports: () => import('./pages/reports.js'), productivity: () => import('./pages/productivity.js'),
  projects: () => import('./pages/work.js'), clients: () => import('./pages/work.js'), tasks: () => import('./pages/work.js'),
  settings: () => import('./pages/settings.js'),
};

export const app = { state: null, page: null, route: 'home', sub: '' };
const side = $('#side'), main = $('#main');

function drawSide() {
  const st = app.state;
  const s = st?.session;
  const tracking = st?.settings.trackingEnabled;
  const live = s
    ? `<div class="live-row"><span class="dot round" style="background:${SESSION[s.type].color}"></span><span>${SESSION[s.type].label}</span><span class="live-time" data-clock="down" data-at="${s.stop}">${clock(s.stop - nowS())}</span></div>
       <div class="silent ellipsis">${esc(s.title || 'Untitled session')}</div>`
    : `<div class="live-row"><span class="live-dot ${tracking ? '' : 'off'}"></span><span>Since break</span><span class="live-time" data-clock="up" data-at="${st?.lastBreakEnd || nowS()}">${clock(nowS() - (st?.lastBreakEnd || nowS()))}</span></div>
       <div class="silent ellipsis">${tracking ? `Tracking · ${esc(st?.current?.app?.name || 'waiting…')}` : 'Tracking is paused'}</div>`;
  side.innerHTML = `
    <div class="side-top"><button class="btn ghost icon" id="collapse" aria-label="Collapse sidebar">${icon('panel-left')}</button></div>
    <div class="ws"><div class="ws-mark">C</div><div class="ws-name">Cadence</div></div>
    <nav class="nav">${NAV.map(([g, items]) => `<div class="eyebrow">${g}</div>` + items.map(([r, ic, l]) =>
      `<a href="#${r}" class="${app.route === r ? 'on' : ''}" title="${l}">${icon(ic)}<span class="label-t">${l}</span></a>`).join('')).join('')}
    </nav>
    <div class="side-foot">
      <div class="live" id="live" title="Open the timer">${live}</div>
      <nav class="nav" style="flex:none"><a href="#settings" class="${app.route === 'settings' ? 'on' : ''}" title="Settings">${icon('settings')}<span class="label-t">Settings</span></a></nav>
    </div>`;
  $('#collapse').onclick = () => document.querySelector('.shell').classList.toggle('collapsed');
  $('#live').onclick = () => { location.hash = 'timer'; };
}

async function refreshState() {
  app.state = await api('state');
  setClock24(app.state.settings.twentyFourHourEnabled);
  drawSide();
}

async function go() {
  const [route, ...rest] = (location.hash.slice(1) || 'home').split('/');
  const r = PAGES[route] ? route : 'home';
  app.route = r; app.sub = rest.join('/');
  drawSide();
  app.page?.unmount?.();
  const mod = await PAGES[r]();
  main.innerHTML = '';
  app.page = mod;
  await mod.mount(main, { app, kind: r, sub: app.sub, refreshState });
}

let pending = null;
window.cadence.on('changed', () => {
  clearTimeout(pending);
  pending = setTimeout(async () => {
    await refreshState();
    // Do not redraw under the user's cursor: a later change event will catch up.
    if (main.contains(document.activeElement) && document.activeElement.matches('input,select,textarea')) return;
    app.page?.refresh?.();
  }, 150);
});
window.cadence.on('route', (r) => { location.hash = r; });
addEventListener('hashchange', go);

// One clock for every live timer on the page.
setInterval(() => {
  for (const el of document.querySelectorAll('[data-clock]')) {
    const at = Number(el.dataset.at);
    el.textContent = clock(el.dataset.clock === 'down' ? at - nowS() : nowS() - at);
  }
  app.page?.tick?.();
}, 1000);

await refreshState();
await go();
