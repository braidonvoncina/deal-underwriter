// Shared by every calculator page: formatting, theme, calculator menu, input form, saved deals.
const PAGES = [
  { href: 'index.html', name: 'Residential', sub: 'Australia' },
  { href: 'commercial-au.html', name: 'Commercial and multifamily', sub: 'Australia' },
  { name: 'Residential', sub: 'United States', soon: true },
  { name: 'Commercial', sub: 'United States', soon: true },
];

const $ = (n, signed) => {
  const s = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Math.abs(Math.round(n)));
  return n < -0.5 ? '-' + s : signed && n > 0.5 ? '+' + s : s;
};
const pc = (n, d = 2) => (isFinite(n) ? n.toFixed(d) : '0.00') + '%';
const cls = (n) => (n < -0.5 ? 'neg' : n > 0.5 ? 'pos' : '');
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const row = (l, v, c = '') => `<div class="row"><span>${l}</span><b class="${c}">${v}</b></div>`;
const kpi = (l, v, sub, c = '') => `<div class="k"><span>${l}</span><b class="${c}">${v}</b><em>${sub}</em></div>`;
const learn = (t) => `<details class="learn"><summary>How this is worked out</summary>${t}</details>`;
const LVL = { bad: 'Risk', warn: 'Watch', ok: 'Good', info: 'Note' };
const ORDER = { bad: 0, warn: 1, ok: 2, info: 3 };
const byLevel = (a, b) => ORDER[a.lvl] - ORDER[b.lvl];
const flagList = (fl) => `<div class="flags">${fl.map((f) => `<div class="flag f-${f.lvl}"><b><span class="tag">${LVL[f.lvl]}</span>${esc(f.head)}</b><p>${esc(f.why)}</p></div>`).join('')}</div>
  <p class="note">Rules of thumb to question a deal with. They are prompts to dig deeper, not a verdict.</p>`;

const openSecs = new Set();
const sec = (id, title, body) => `<details class="card sec" data-id="${id}"${openSecs.has(id) ? ' open' : ''}><summary>${title}</summary><div class="body">${body}</div></details>`;
const trackSections = (el) => el.addEventListener('toggle', (e) => {
  const id = e.target.dataset && e.target.dataset.id;
  if (id) e.target.open ? openSecs.add(id) : openSecs.delete(id);
}, true);

const withCommas = (s) => {
  const [i, d] = s.split('.');
  const n = i.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return d === undefined ? n : n + '.' + d.slice(0, 3);
};
// Formats a text input as the user types and keeps the caret beside the same digit.
function formatInput(el) {
  const before = el.value.slice(0, el.selectionStart).replace(/[^\d.]/g, '').length;
  const raw = el.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*)\./, '$1');
  el.value = withCommas(raw);
  let p = 0, seen = 0;
  while (p < el.value.length && seen < before) { if (/[\d.]/.test(el.value[p])) seen++; p++; }
  el.setSelectionRange(p, p);
  return parseFloat(raw) || 0;
}

// Theme toggle and calculator menu.
(function () {
  const root = document.documentElement, btn = document.getElementById('theme');
  const cur = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const paint = () => { if (btn) btn.textContent = cur() === 'dark' ? 'Switch to day mode' : 'Switch to night mode'; };
  try { const saved = localStorage.getItem('theme'); if (saved) root.dataset.theme = saved; } catch (e) {}
  if (btn) btn.addEventListener('click', () => {
    const next = cur() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    paint();
  });
  paint();

  const nav = document.getElementById('nav');
  if (!nav) return;
  const here = location.pathname.split('/').pop() || 'index.html';
  nav.innerHTML = `<button class="navbtn" id="navbtn" type="button" aria-expanded="false" aria-controls="navmenu" aria-haspopup="true">Calculators<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg></button>
    <div class="navmenu" id="navmenu" hidden>${PAGES.map((p) => p.soon
      ? `<span aria-disabled="true"><b>${p.name}</b><small>${p.sub} · coming soon</small></span>`
      : `<a href="${p.href}"${p.href === here ? ' aria-current="page"' : ''}><b>${p.name}</b><small>${p.sub}</small></a>`).join('')}</div>`;
  const b = document.getElementById('navbtn'), m = document.getElementById('navmenu');
  const set = (open) => { m.hidden = !open; b.setAttribute('aria-expanded', open); };
  b.addEventListener('click', () => set(m.hidden));
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.hidden) { set(false); b.focus(); } });
})();

// Input form. TABS: [[tabName, [[key, label, unit, selectOptions, width, hint]]]]. unit: '$', '%', 'yrs', 'sel' or 'roll'.
// State S is edited in place. Types follow S[key]: boolean, number or string.
function createForm(TABS, S, { onChange, onField, afterSync }) {
  const touched = new Set(), panels = document.getElementById('panels'), tabs = document.getElementById('tabs');
  tabs.innerHTML = TABS.map((t, i) =>
    `<button class="tab" role="tab" id="tab${i}" aria-selected="${i === 0}" aria-controls="p${i}" data-i="${i}"><i>${i + 1}</i>${t[0]}</button>`).join('');
  panels.innerHTML = TABS.map((t, i) =>
    `<div class="panel" role="tabpanel" id="p${i}" aria-labelledby="tab${i}"${i ? ' hidden' : ''}>${t[1].map(([k, label, unit, o, w, hint]) => {
      if (unit === 'roll') return `<div class="f full" id="roll-host"></div>`;
      const full = w === 'full' ? ' full' : '';
      const ctl = unit === 'sel'
        ? `<div class="box"><select id="in-${k}" data-k="${k}">${o.map((x) => `<option value="${x[0]}">${x[1]}</option>`).join('')}</select></div>`
        : `<div class="box">${unit === '$' ? '<span>$</span>' : ''}<input id="in-${k}" data-k="${k}" type="text" inputmode="decimal" autocomplete="off">${unit !== '$' ? `<span>${unit}</span>` : ''}</div>`;
      return `<div class="f${full}"><label for="in-${k}">${label}</label>${ctl}${hint !== undefined ? `<small id="h-${k}">${hint}</small>` : ''}</div>`;
    }).join('')}</div>`).join('');

  function sync(except) {
    panels.querySelectorAll('[data-k]').forEach((el) => {
      if (el.id === except) return;
      const v = S[el.dataset.k];
      el.value = typeof v === 'boolean' ? (v ? '1' : '0') : (el.tagName === 'INPUT' ? withCommas(String(Math.round(v * 100) / 100)) : v);
    });
    if (afterSync) afterSync();
  }
  panels.addEventListener('input', (e) => {
    const el = e.target, k = el.dataset.k;
    if (!k) return;
    const cur = S[k];
    if (el.tagName === 'INPUT') { S[k] = formatInput(el); touched.add(k); }
    else S[k] = typeof cur === 'boolean' ? el.value === '1' : typeof cur === 'number' ? parseFloat(el.value) || 0 : el.value;
    if (onField) onField(k, touched);
    sync(el.id);
    onChange();
  });
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    tabs.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', t === b));
    panels.querySelectorAll('.panel').forEach((p, i) => { p.hidden = i !== +b.dataset.i; });
  });
  sync();
  return { sync, touched };
}

// Saved deals, stored on this device. view(inputs) -> { subtitle, rows: [[label, valueHtml, cls, score]], flags }.
// rows with a score get a "Best" tag on the highest score when two or more deals are saved.
function createDeals({ key, max = 6, defaultName, snapshot, restore, view, rerender, resultsEl }) {
  let deals = [], saveName = '', msg = '', persisted = true;
  try { deals = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { deals = []; }
  const persist = () => { try { localStorage.setItem(key, JSON.stringify(deals)); persisted = true; } catch (e) { persisted = false; } };

  function body() {
    const views = deals.map((d) => ({ d, v: view(d.inputs) }));
    const best = [];
    views.forEach(({ v }) => v.rows.forEach((r, i) => { if (r[3] !== undefined) best[i] = Math.max(best[i] === undefined ? -Infinity : best[i], r[3]); }));
    const multi = views.length > 1;
    const cards = views.map(({ d, v }) => `<article class="deal"><div><h4>${esc(d.name)}</h4><p class="note">${esc(v.subtitle)}</p></div>
      <div>${v.rows.map((r, i) => row(r[0], r[1] + (multi && r[3] !== undefined && r[3] === best[i] ? '<span class="best">Best</span>' : ''), r[2] || '')).join('')}</div>
      <ul class="chips">${v.flags.sort(byLevel).slice(0, 3).map((x) => `<li class="chip f-${x.lvl}"><span class="tag">${LVL[x.lvl]}</span>${esc(x.head)}</li>`).join('')}</ul>
      <div><label class="note" for="n-${d.id}">Notes</label><textarea id="n-${d.id}" data-notes="${d.id}" rows="3" placeholder="Why it works, what to check, who to call">${esc(d.notes)}</textarea></div>
      <div class="btns"><button class="btn pri" type="button" data-load="${d.id}">Load</button><button class="btn" type="button" data-del="${d.id}">Delete</button></div></article>`);
    return `<div class="savebar"><input id="deal-name" value="${esc(saveName)}" placeholder="${esc(defaultName())}" aria-label="Deal name" autocomplete="off"><button class="btn pri" type="button" data-save>Save this deal</button></div>
      <p class="note" role="status">${esc(msg) || (persisted ? 'Deals are saved on this device only.' : 'Storage is blocked in this browser, so deals last until you close the page.')}</p>
      ${cards.length ? `<div class="deals">${cards.join('')}</div>` : '<p class="note">No saved deals yet. Enter a property, give it a name and tap Save. Saved deals sit side by side here so you can compare them.</p>'}`;
  }
  resultsEl.addEventListener('input', (e) => {
    if (e.target.id === 'deal-name') saveName = e.target.value;
    if (e.target.dataset.notes) {
      const d = deals.find((x) => x.id === e.target.dataset.notes);
      if (d) { d.notes = e.target.value; persist(); }
    }
  });
  resultsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-save')) {
      if (deals.length >= max) { msg = `You can keep ${max} deals. Delete one to save another.`; return rerender(); }
      const name = saveName.trim() || defaultName();
      deals.push({ id: String(Date.now()), name, notes: '', inputs: JSON.parse(JSON.stringify(snapshot())) });
      persist(); saveName = ''; msg = `Saved "${name}".`; rerender();
    } else if (b.dataset.del) {
      deals = deals.filter((x) => x.id !== b.dataset.del); persist(); msg = 'Deal deleted.'; rerender();
    } else if (b.dataset.load) {
      const d = deals.find((x) => x.id === b.dataset.load);
      if (d) { restore(JSON.parse(JSON.stringify(d.inputs))); msg = `Loaded "${d.name}" into the calculator.`; rerender(); }
    }
  });
  return { body };
}
