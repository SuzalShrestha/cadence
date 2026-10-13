// Quick start (Rize "Shortcut" window): opened by the global shortcut, hides on blur or Esc.
import { api, esc, icon, $, $$, clock, nowS, durText, SESSION, options } from './lib.js';

const root = $('#q');
let st, projects = [], type = 'focus', mins = null;
const LEN = { focus: [25, 45, 60, 90], meeting: [15, 30, 45, 60], break: [5, 10, 15, 30] };
const KEY = { focus: 'defaultFocusSessionTime', meeting: 'defaultMeetingSessionTime', break: 'defaultBreakSessionTime' };

async function load() {
  [st, projects] = await Promise.all([api('state'), api('list', 'projects')]);
  mins = null;
  draw();
}

function draw() {
  const s = st.session;
  const m = mins ?? Math.round(st.settings[KEY[type]] / 60);
  root.innerHTML = s ? `
    <div class="head"><span class="dot round" style="width:10px;height:10px;background:${SESSION[s.type].color}"></span><h2>${SESSION[s.type].label} session</h2><div class="grow"></div><span class="kbd">esc</span></div>
    <div style="text-align:center;padding:18px 0 6px"><div style="font-size:56px;font-weight:300;color:var(--text-strong);font-variant-numeric:tabular-nums" id="clk">${clock(s.stop - nowS())}</div>
      <div class="silent">${esc(s.title || 'Untitled session')}</div></div>
    <div class="grid2"><button class="btn lg" data-ext>${icon('plus', 15)}Extend 5 min</button><button class="btn lg danger" data-end>${icon('square', 15)}End session</button></div>
    <div class="foot"><button class="btn ghost sm" data-dash>${icon('house', 14)}Open dashboard</button></div>`
  : `
    <div class="head"><h2>Start a session</h2><div class="grow"></div><span class="kbd">esc</span></div>
    <div class="types">${Object.entries(SESSION).map(([t, v]) => `<button data-t="${t}" aria-pressed="${t === type}" style="${t === type ? `color:${v.color}` : ''}">${icon(v.icon, 20)}<span style="color:var(--text-strong)">${v.label}</span></button>`).join('')}</div>
    <div class="chips">${LEN[type].map((x) => `<button data-m="${x}" aria-pressed="${x === m}">${durText(x * 60)}</button>`).join('')}</div>
    <input class="input" id="title" placeholder="${type === 'break' ? 'Stretch, walk, water…' : 'What are you working on?'}">
    ${type === 'break' ? '' : `<select class="input" id="proj">${options(projects, null, 'No project')}</select>`}
    <div class="foot"><button class="btn ghost sm" data-dash>${icon('house', 14)}Dashboard</button><div class="grow"></div>
      <span class="silent" style="font-size:12px">Press <span class="kbd">↵</span> to start</span><button class="btn accent" data-go>${icon('play', 14)}Start</button></div>`;
  $$('[data-t]', root).forEach((b) => b.onclick = () => { type = b.dataset.t; mins = null; draw(); });
  $$('[data-m]', root).forEach((b) => b.onclick = () => { mins = Number(b.dataset.m); draw(); });
  $('[data-go]', root)?.addEventListener('click', start);
  $('[data-ext]', root)?.addEventListener('click', () => api('extendSession', 300));
  $('[data-end]', root)?.addEventListener('click', async () => { await api('stopSession'); api('toggleQuick'); });
  $('[data-dash]', root).onclick = () => { api('showDashboard'); api('toggleQuick'); };
  $('#title', root)?.focus();
}

async function start() {
  const m = mins ?? Math.round(st.settings[KEY[type]] / 60);
  await api('startSession', type, { length: m * 60, title: $('#title', root).value.trim(), projectId: $('#proj', root)?.value || null });
  api('toggleQuick');
}

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') api('toggleQuick');
  else if (e.key === 'Enter' && !st.session) start();
});
setInterval(() => { const c = $('#clk'); if (c && st.session) c.textContent = clock(st.session.stop - nowS()); }, 1000);
addEventListener('blur', () => document.activeElement?.blur()); // the window hides on blur; reopen fresh
window.cadence.on('changed', () => { if (document.activeElement?.id !== 'title') load(); });
load();
