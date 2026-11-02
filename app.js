const S = { state: 'VIC', price: 500000, invest: true, deposit: 50000, pct: 10, rate: 6, term: 30, ioYears: 5,
  weekly: 481, growth: 6, infl: 2.5, council: 2500, insurance: 1200, maintenance: 500, other: 500, acq: 2000,
  tax: 37, construction: 300000, pne: 50000, method: 'dv', extra: 0, extraFreq: 'w' };
const touched = new Set();
const sens = { rate: 0, growth: 0, vacancy: false, exp: false };
const openSecs = new Set(['sum', 'check', 'deals', 'out', 'fin', 'loan']);

const DEALS_KEY = 'deals-v1', MAX_DEALS = 6;
const LVL = { bad: 'Risk', warn: 'Watch', ok: 'Good', info: 'Note' };
const ORDER = { bad: 0, warn: 1, ok: 2, info: 3 };
let deals = [], saveName = '', dealMsg = '', persisted = true;
loadDeals();

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function loadDeals() { try { deals = JSON.parse(localStorage.getItem(DEALS_KEY)) || []; } catch (e) { deals = []; } }
function persistDeals() { try { localStorage.setItem(DEALS_KEY, JSON.stringify(deals)); persisted = true; } catch (e) { persisted = false; } }
const byLevel = (a, b) => ORDER[a.lvl] - ORDER[b.lvl];

function dealCard(d, c, best, multi) {
  const tag = (on) => (on && multi ? '<span class="best">Best</span>' : '');
  const f = flags(d.inputs, c).sort(byLevel).slice(0, 3);
  return `<article class="deal"><div><h4>${esc(d.name)}</h4><p class="note">${d.inputs.state} · ${$(d.inputs.price)} · ${d.inputs.invest ? 'Investment' : 'Owner occupier'}</p></div>
    <div>${row('Cash flow / wk', $(c.cf / 52) + tag(c.cf === best.cf), cls(c.cf))}${row('Net yield', pc(c.netYield) + tag(c.netYield === best.y))}${row('LVR', pc(c.lvr, 1))}${row('Weekly rent', $(d.inputs.weekly))}${row('Cash to settle', $(d.inputs.deposit + d.inputs.acq + c.duty))}${row('10 yr total return', $(c.totalReturn), cls(c.totalReturn))}</div>
    <ul class="chips">${f.map((x) => `<li class="chip f-${x.lvl}"><span class="tag">${LVL[x.lvl]}</span>${esc(x.head)}</li>`).join('')}</ul>
    <div><label class="note" for="n-${d.id}">Notes</label><textarea id="n-${d.id}" data-notes="${d.id}" rows="3" placeholder="Why it works, what to check, who to call">${esc(d.notes)}</textarea></div>
    <div class="btns"><button class="btn pri" type="button" data-load="${d.id}">Load</button><button class="btn" type="button" data-del="${d.id}">Delete</button></div></article>`;
}

function dealsBody() {
  const calcs = deals.map((d) => ({ d, c: calc(d.inputs) }));
  const best = { cf: Math.max(...calcs.map((x) => x.c.cf)), y: Math.max(...calcs.map((x) => x.c.netYield)) };
  return `<div class="savebar"><input id="deal-name" value="${esc(saveName)}" placeholder="${esc(S.state + ' ' + $(S.price))}" aria-label="Deal name" autocomplete="off"><button class="btn pri" type="button" data-save>Save this deal</button></div>
    <p class="note" role="status">${esc(dealMsg) || (persisted ? 'Deals are saved on this device only.' : 'Storage is blocked in this browser, so deals last until you close the page.')}</p>
    ${calcs.length ? `<div class="deals">${calcs.map((x) => dealCard(x.d, x.c, best, calcs.length > 1)).join('')}</div>`
      : '<p class="note">No saved deals yet. Enter a property, give it a name and tap Save. Saved deals sit side by side here so you can compare them.</p>'}`;
}

const opts = (a) => a.map(([v, t]) => ({ v, t }));
const TABS = [
  ['Property', [
    ['state', 'State / territory', 'sel', opts(['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'].map((s) => [s, s]))],
    ['price', 'Purchase price', '$'],
    ['invest', 'Property type', 'sel', opts([['1', 'Investment property'], ['0', 'Owner occupier']]), 'full'],
  ]],
  ['Financing', [
    ['deposit', 'Deposit', '$'], ['pct', 'Deposit %', '%'],
    ['rate', 'Interest rate', '%'], ['term', 'Loan term', 'yrs'],
    ['ioYears', 'Interest-only period', 'yrs', null, 'full', 'Used in the P&I vs interest-only comparison.'],
  ]],
  ['Income', [
    ['weekly', 'Weekly rent', '$', null, '', 'rentNote'],
    ['infl', 'Inflation', '%'],
    ['growth', 'Capital growth', 'sel', opts([['4', 'Conservative 4% p.a.'], ['6', 'Moderate 6% p.a.'], ['8', 'Optimistic 8% p.a.']]), 'full'],
  ]],
  ['Expenses', [
    ['council', 'Council rates /yr', '$'], ['insurance', 'Insurance /yr', '$'],
    ['maintenance', 'Maintenance /yr', '$'], ['other', 'Other costs /yr', '$'],
    ['acq', 'One-time acquisition costs', '$', null, 'full', 'Legal fees, inspections, bank fees.'],
  ]],
  ['Tax', [
    ['tax', 'Income tax bracket', 'sel', opts([['0', 'Tax-free (0%)'], ['19', '$18,201 to $45,000 (19%)'], ['32.5', '$45,001 to $120,000 (32.5%)'], ['37', '$120,001 to $180,000 (37%)'], ['45', '$180,001+ (45%)']]), 'full'],
    ['construction', 'Construction value', '$', null, '', 'Auto: 60% of price'],
    ['pne', 'Plant & equipment', '$', null, '', 'Auto: 10% of price'],
    ['method', 'Depreciation method', 'sel', opts([['dv', 'Diminishing value'], ['pc', 'Prime cost']]), 'full'],
  ]],
  ['Extra', [
    ['extra', 'Extra repayment', '$'],
    ['extraFreq', 'Frequency', 'sel', opts([['w', 'Weekly'], ['f', 'Fortnightly'], ['m', 'Monthly']])],
  ]],
];

const $ = (n, signed) => {
  const s = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Math.abs(Math.round(n)));
  return n < -0.5 ? '-' + s : signed && n > 0.5 ? '+' + s : s;
};
const pc = (n, d = 2) => n.toFixed(d) + '%';
const cls = (n) => (n < -0.5 ? 'neg' : n > 0.5 ? 'pos' : '');
const row = (l, v, c = '') => `<div class="row"><span>${l}</span><b class="${c}">${v}</b></div>`;
const kpi = (l, v, sub, c = '') => `<div class="k"><span>${l}</span><b class="${c}">${v}</b><em>${sub}</em></div>`;
const learn = (t) => `<details class="learn"><summary>How this is worked out</summary>${t}</details>`;
const sec = (id, title, body) => `<details class="card sec" data-id="${id}"${openSecs.has(id) ? ' open' : ''}><summary>${title}</summary><div class="body">${body}</div></details>`;

function buildInputs() {
  document.getElementById('tabs').innerHTML = TABS.map((t, i) =>
    `<button class="tab" role="tab" id="tab${i}" aria-selected="${i === 0}" aria-controls="p${i}" data-i="${i}"><i>${i + 1}</i>${t[0]}</button>`).join('');
  document.getElementById('panels').innerHTML = TABS.map((t, i) =>
    `<div class="panel" role="tabpanel" id="p${i}" aria-labelledby="tab${i}"${i ? ' hidden' : ''}>${t[1].map(([k, label, unit, o, w, hint]) => {
      const full = w === 'full' ? ' full' : '';
      const ctl = unit === 'sel'
        ? `<div class="box"><select id="in-${k}" data-k="${k}">${o.map((x) => `<option value="${x.v}">${x.t}</option>`).join('')}</select></div>`
        : `<div class="box">${unit === '$' ? '<span>$</span>' : ''}<input id="in-${k}" data-k="${k}" type="text" inputmode="decimal" autocomplete="off">${unit !== '$' ? `<span>${unit}</span>` : ''}</div>`;
      return `<div class="f${full}"><label for="in-${k}">${label}</label>${ctl}${hint ? `<small id="h-${k}">${hint === 'rentNote' ? '' : hint}</small>` : ''}</div>`;
    }).join('')}</div>`).join('');
  syncInputs();
}

function syncInputs(except) {
  document.querySelectorAll('[data-k]').forEach((el) => {
    if (el.id === except) return;
    const v = S[el.dataset.k];
    el.value = typeof v === 'boolean' ? (v ? '1' : '0') : (el.tagName === 'INPUT' ? withCommas(String(Math.round(v * 100) / 100)) : v);
  });
  const note = document.getElementById('h-weekly');
  if (note) note.textContent = '= ' + $(S.weekly * 52 / 12) + ' per month, ' + $(S.weekly * 52) + ' per year';
}

const withCommas = (s) => {
  const [i, d] = s.split('.');
  const n = i.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return d === undefined ? n : n + '.' + d.slice(0, 3);
};

function onInput(e) {
  const el = e.target, k = el.dataset.k;
  if (!k) return;
  let v = el.value;
  if (el.tagName === 'INPUT') {
    const digitsBeforeCaret = el.value.slice(0, el.selectionStart).replace(/[^\d.]/g, '').length;
    v = el.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*)\./, '$1');
    el.value = withCommas(v);
    let p = 0, seen = 0;
    while (p < el.value.length && seen < digitsBeforeCaret) { if (/[\d.]/.test(el.value[p])) seen++; p++; }
    el.setSelectionRange(p, p);
  }
  if (k === 'state' || k === 'method' || k === 'extraFreq') S[k] = v;
  else if (k === 'invest') S.invest = v === '1';
  else {
    S[k] = parseFloat(v) || 0;
    touched.add(k);
    if (k === 'price') {
      S.deposit = S.price * S.pct / 100;
      if (!touched.has('construction')) S.construction = S.price * 0.6;
      if (!touched.has('pne')) S.pne = S.price * 0.1;
    }
    if (k === 'deposit') S.pct = S.price ? S.deposit / S.price * 100 : 0;
    if (k === 'pct') S.deposit = S.price * S.pct / 100;
  }
  syncInputs(el.id);
  render();
}

function chart(series) {
  const W = 640, H = 250, L = 56, R = 12, T = 12, B = 28, n = series.length - 1;
  const max = Math.max(...series.map((p) => p.value)) * 1.05, X = (y) => L + (y / n) * (W - L - R), Y = (v) => T + (1 - v / max) * (H - T - B);
  const line = (key, color) => `<polyline fill="none" stroke="var(${color})" stroke-width="2.2" stroke-linejoin="round" points="${series.map((p) => X(p.y).toFixed(1) + ',' + Y(p[key]).toFixed(1)).join(' ')}"/>`;
  const yt = [0, .25, .5, .75, 1].map((f) => max * f);
  const label = (v) => v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + Math.round(v / 1e3) + 'k';
  return `<div class="tbl"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px" role="img" aria-label="Property value, loan balance and equity over ${n} years">
    ${yt.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${label(v)}</text>`).join('')}
    ${series.filter((p) => p.y % 5 === 0).map((p) => `<text x="${X(p.y)}" y="${H - 8}" text-anchor="middle">${p.y}</text>`).join('')}
    ${line('value', '--chart-a')}${line('debt', '--chart-b')}${line('equity', '--chart-c')}</svg></div>
    <div class="legend"><span><i style="background:var(--chart-a)"></i>Property value</span><span><i style="background:var(--chart-b)"></i>Loan balance</span><span><i style="background:var(--chart-c)"></i>Equity</span><span>Years on the bottom axis</span></div>`;
}

function render() {
  const c = calc(S), s = sensitivity(S, sens), L = c.loans, wk = c.cf / 52;
  const sc = s.cur, base = s.base;
  const sections = [];

  sections.push(sec('sum', 'Investment summary', `
    <div class="kpis">
      ${kpi('Weekly cash flow', $(wk), 'After tax, year 1', cls(wk))}
      ${kpi('Net yield', pc(c.netYield), 'Rent less running costs, on price')}
      ${kpi('10 yr capital growth', $(c.equity10), S.growth + '% p.a.', 'pos')}
      ${kpi('LVR', pc(c.lvr, 1), 'Loan to value')}
      ${kpi('Cash to settle', $(S.deposit + S.acq + c.duty), 'Deposit + stamp duty + acquisition')}
    </div>
    ${learn(`<p><code>Net yield = (annual rent - running costs) / price</code> = (${$(c.rent)} - ${$(c.exp)}) / ${$(S.price)}.</p>
      <p><code>Weekly cash flow = (rent - costs - loan repayments + tax benefits) / 52</code>. Tax benefits are depreciation savings plus the refund on the cash loss.</p>
      <p><code>LVR = loan / price</code>. Above 80% most lenders add mortgage insurance.</p>`)}`));

  const fl = flags(S, c).sort(byLevel);
  sections.push(sec('check', 'Deal check', `<div class="flags">${fl.map((f) => `<div class="flag f-${f.lvl}"><b><span class="tag">${LVL[f.lvl]}</span>${esc(f.head)}</b><p>${esc(f.why)}</p></div>`).join('')}</div>
    <p class="note">Rules of thumb to question a deal with. They are prompts to dig deeper, not a verdict.</p>`));
  sections.push(sec('deals', 'Saved deals', dealsBody()));

  sections.push(sec('out', '10 year outlook', `
    <div class="kpis">
      ${kpi('Projected value', $(c.value10), 'Nominal, includes inflation')}
      ${kpi('Net cash flow after tax', $(c.cf10, true), '10 year total', cls(c.cf10))}
      ${kpi('Illustrative total return', $(c.totalReturn), 'Capital growth + cash flow', cls(c.totalReturn))}
    </div>
    ${learn(`<p><code>Value = price x (1 + growth)^10</code>. Rent and expenses grow with ${S.infl}% inflation each year while loan repayments stay fixed, so cash flow improves over time.</p>`)}`));

  sections.push(sec('tax', S.state + ' costs and taxes', `
    <div class="kpis">
      ${kpi('Stamp duty', $(c.duty), 'One-time')}
      ${kpi('Land tax', $(c.lt), 'Per year, ' + (S.invest ? 'investor rates' : 'not charged on a home'))}
      ${kpi('Upfront tax cost', $(c.duty + c.lt), 'Duty + first year land tax')}
    </div>
    ${learn(`<p>Duty is a state-by-state sliding scale on the price. Land tax here is applied to the purchase price, a simplification: real land tax uses the unimproved land value, so it is usually lower. Surcharges, concessions and trust or foreign-buyer rules are not included.</p>`)}`));

  sections.push(sec('fin', 'Annual financial summary', `
    <div class="two">
      <div class="col"><h4>Income and tax benefits</h4>
        ${row('Rental income', $(c.rent))}${row('Depreciation savings', $(c.dp.y1save), 'pos')}${row('Negative gearing refund', $(c.ng), 'pos')}</div>
      <div class="col"><h4>Expenses</h4>
        ${row('Loan repayments', $(c.annualLoan))}${row('Council rates', $(S.council))}${row('Insurance', $(S.insurance))}${row('Maintenance', $(S.maintenance))}${row('Other costs', $(S.other))}
        ${row('<b>Total expenses</b>', $(c.exp + c.annualLoan))}</div>
    </div>
    <div class="k"><span>Net annual return after tax</span><b class="${cls(c.cf)}">${$(c.cf)}</b><em>${$(c.cf / 12)} per month</em></div>
    ${learn(`<p>Negative gearing refund = cash loss x tax rate. When rent is below costs plus repayments, the loss reduces taxable income. This calculator, like the original, counts the full loss including principal repayments, which overstates the refund. A tax agent would only count interest, so treat this figure as optimistic.</p>`)}`));

  sections.push(sec('loan', 'Principal and interest vs interest only', `
    <div class="two">
      <div class="col"><h4>Principal and interest</h4>
        ${row('Monthly payment', $(L.pi.monthly))}${row('Annual repayments', $(L.pi.annual))}${row('Cash flow before tax benefits', $(L.pi.cf), cls(L.pi.cf))}${row('Return on cash invested', pc(L.pi.roi), cls(L.pi.roi))}${row('Total interest, ' + S.term + ' yrs', $(L.pi.interest))}</div>
      <div class="col"><h4>Interest only, ${S.ioYears} yrs</h4>
        ${row('Monthly payment', $(L.io.monthly))}${row('Annual repayments', $(L.io.annual))}${row('Cash flow before tax benefits', $(L.io.cf), cls(L.io.cf))}${row('Return on cash invested', pc(L.io.roi), cls(L.io.roi))}${row('Then monthly P&I', $(L.io.after))}${row('Total interest, lifetime', $(L.io.interest))}</div>
    </div>
    <div class="kpis">
      ${kpi('Monthly saving', $(L.pi.monthly - L.io.monthly), 'IO vs P&I')}
      ${kpi('Cash flow impact', $((L.io.cf - L.pi.cf)), 'Better each year with IO')}
      ${kpi('Extra lifetime interest', $(L.io.interest - L.pi.interest), 'IO costs more', 'neg')}
    </div>
    <p class="note">After the interest-only period, repayments step up to ${$(L.io.after)} a month, ${$(L.io.after - L.pi.monthly)} more than P&I. No principal is repaid during IO, so equity only grows through price growth.</p>
    ${learn(`<p><code>P&I payment = L x r(1+r)^n / ((1+r)^n - 1)</code> where r is the monthly rate and n the number of months. <code>IO payment = L x annual rate / 12</code>.</p>`)}`));

  sections.push(sec('extra', 'Extra repayments', c.extra ? `
    <div class="kpis">
      ${kpi('Interest saved', $(c.extra.std - c.extra.interest), 'Over the loan', 'pos')}
      ${kpi('Years saved', (S.term - c.extra.years).toString(), 'Loan paid off in ' + c.extra.years + ' yrs', 'pos')}
      ${kpi('Total extra paid', $(c.extra.years * 12 * (S.extraFreq === 'w' ? S.extra * 52 / 12 : S.extraFreq === 'f' ? S.extra * 26 / 12 : S.extra)), 'Across the loan')}
    </div>` : `<p class="note">Set an extra repayment on the Extra tab to see how much interest and time it saves.</p>`));

  sections.push(sec('dep', 'Depreciation', `
    <div class="kpis">
      ${kpi('Year 1 deductions', $(c.dp.y1), 'Tax saving ' + $(c.dp.y1save))}
      ${kpi('10 year deductions', $(c.dp.ten), 'Total')}
      ${kpi('Lifetime, 40 yrs', $(c.dp.life), 'Total')}
    </div>
    <div class="tbl"><table><tr><th>Year</th><th class="r">Capital works</th><th class="r">Plant &amp; equip.</th><th class="r">Total</th><th class="r">Tax saving</th></tr>
      ${c.dp.rows.slice(0, 5).map((r) => `<tr><td>${r.y}</td><td class="r">${$(r.cw)}</td><td class="r">${$(r.pe)}</td><td class="r">${$(r.total)}</td><td class="r">${$(r.save)}</td></tr>`).join('')}</table></div>
    <div class="kpis">
      ${kpi('Interest saved by using the tax benefit', $(c.taxPay.std - c.taxPay.interest), 'Paid into the loan each year', 'pos')}
      ${kpi('Time saved', (S.term - c.taxPay.years) + ' years', 'Earlier payoff')}
    </div>
    ${learn(`<p><code>Capital works = construction value x 2.5%</code> a year for 40 years. <code>Plant and equipment</code> uses 20% of the remaining value each year (diminishing value) or 10% of the original (prime cost), for up to 15 years. Second-hand plant and equipment in residential property bought after 9 May 2017 is generally not deductible, so this suits new properties. A quantity surveyor schedule gives the real numbers.</p>`)}`));

  sections.push(sec('eq', 'Equity growth', `${chart(c.series)}
    ${learn(`<p>Equity = property value - loan balance. Value grows at ${S.growth}% a year; the loan balance falls as principal is repaid.</p>`)}`));

  sections.push(sec('scen', 'Capital growth scenarios', `
    <div class="tbl"><table><tr><th>Growth</th><th class="r">10 years</th><th class="r">20 years</th><th class="r">30 years</th></tr>
      ${c.scen.map((r) => `<tr><td>${r.rate}% p.a.${r.rate === S.growth ? ' (yours)' : ''}</td>${r.rows.map((x) => `<td class="r">${$(x.v)}<br><small class="pos">+${x.pct.toFixed(0)}%</small></td>`).join('')}</tr>`).join('')}</table></div>
    <p class="note">Constant growth rates, illustrative only. Real markets move in cycles.</p>`));

  const g = c.cgt;
  sections.push(sec('cgt', 'Capital gains tax on a 10 year sale', `
    <div class="two">
      <div class="col"><h4>Sale summary</h4>
        ${row('Sale price', $(c.value10))}${row('Selling costs (3%)', $(-g.costs))}${row('Capital gains tax', $(-g.tax))}${row('<b>Net proceeds</b>', $(g.net))}</div>
      <div class="col"><h4>CGT calculation</h4>
        ${row('Cost base', $(S.price + S.acq))}${row('Gross capital gain', $(g.gain))}${row(g.discount ? '50% discount' : 'Discount', g.discount ? $(-g.gain / 2) : 'Not applied')}${row('Taxable gain', $(g.taxable))}${row('Effective rate', pc(g.eff, 1))}</div>
    </div>
    ${learn(`<p><code>CGT = (sale price - cost base) x 50% x tax rate</code> when held over 12 months by an Australian resident. Selling costs are shown in proceeds but not deducted from the gain here, so the tax figure runs slightly high. Other income and losses in the same year are ignored.</p>`)}`));

  const dl = (a, b, f) => `<td class="r ${cls(a - b)}">${f(a)}</td>`;
  const seg = (key, vals) => `<div class="seg" role="group">${vals.map(([v, t]) => `<button data-sens="${key}" data-v="${v}" aria-pressed="${sens[key] === v}">${t}</button>`).join('')}</div>`;
  const one = (o) => s.one(o).weekly - base.weekly;
  sections.push(sec('sens', 'What-if testing', `
    <div class="tbl"><table><tr><th></th><th class="r">Base</th><th class="r">With changes</th></tr>
      <tr><td>Weekly cash flow</td><td class="r">${$(base.weekly)}</td>${dl(sc.weekly, base.weekly, $)}</tr>
      <tr><td>Annual return</td><td class="r">${pc(base.ret)}</td>${dl(sc.ret, base.ret, (x) => pc(x))}</tr>
      <tr><td>Cash-on-cash</td><td class="r">${pc(base.roi)}</td>${dl(sc.roi, base.roi, (x) => pc(x))}</tr></table></div>
    <div><p class="note">Interest rate</p>${seg('rate', [[-1, '-1%'], [0, 'Base'], [1, '+1%']])}</div>
    <div><p class="note">Capital growth</p>${seg('growth', [[-1, '-1%'], [0, 'Base'], [1, '+1%']])}</div>
    <div>
      <div class="chk"><input type="checkbox" id="s-vac" ${sens.vacancy ? 'checked' : ''}><label for="s-vac">Vacant 2 weeks a year<small>${$(one({ vacancy: true }), true)} per week</small></label></div>
      <div class="chk"><input type="checkbox" id="s-exp" ${sens.exp ? 'checked' : ''}><label for="s-exp">Expenses +10%<small>${$(one({ exp: true }), true)} per week</small></label></div>
    </div>
    ${learn(`<p>Each toggle reruns the year 1 cash flow with one input changed. A rate rise raises the loan payment; vacancy drops rent to 50 weeks; expense growth lifts running costs. Stress your deal with several at once to see how thin the margin is.</p>`)}`));

  document.getElementById('results').innerHTML = sections.join('');
  document.getElementById('pinbar').innerHTML =
    `<div><span>Cash flow / wk</span><b class="${cls(wk)}">${$(wk)}</b></div><div><span>Net yield</span><b>${pc(c.netYield)}</b></div><div><span>LVR</span><b>${pc(c.lvr, 1)}</b></div>`;
}

buildInputs();
render();
document.getElementById('panels').addEventListener('input', onInput);
document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', t === b));
  document.querySelectorAll('.panel').forEach((p, i) => { p.hidden = i !== +b.dataset.i; });
});
const res = document.getElementById('results');
res.addEventListener('toggle', (e) => {
  const id = e.target.dataset && e.target.dataset.id;
  if (id) e.target.open ? openSecs.add(id) : openSecs.delete(id);
}, true);
res.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sens]');
  if (b) { sens[b.dataset.sens] = +b.dataset.v; render(); }
});
res.addEventListener('change', (e) => {
  if (e.target.id !== 's-vac' && e.target.id !== 's-exp') return;
  if (e.target.id === 's-vac') sens.vacancy = e.target.checked;
  if (e.target.id === 's-exp') sens.exp = e.target.checked;
  render();
});

const root = document.documentElement, themeBtn = document.getElementById('theme');
const curTheme = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const paintTheme = () => { themeBtn.textContent = curTheme() === 'dark' ? 'Switch to day mode' : 'Switch to night mode'; };
try { const saved = localStorage.getItem('theme'); if (saved) root.dataset.theme = saved; } catch (e) {}
themeBtn.addEventListener('click', () => {
  const next = curTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
  paintTheme();
});
paintTheme();

document.getElementById('results').addEventListener('input', (e) => {
  if (e.target.id === 'deal-name') saveName = e.target.value;
  if (e.target.dataset.notes) {
    const d = deals.find((x) => x.id === e.target.dataset.notes);
    if (d) { d.notes = e.target.value; persistDeals(); }
  }
});
document.getElementById('results').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.hasAttribute('data-save')) {
    if (deals.length >= MAX_DEALS) { dealMsg = `You can keep ${MAX_DEALS} deals. Delete one to save another.`; return render(); }
    const name = saveName.trim() || `${S.state} ${$(S.price)}`;
    deals.push({ id: String(Date.now()), name, notes: '', inputs: { ...S } });
    persistDeals(); saveName = ''; dealMsg = `Saved "${name}".`; render();
  } else if (b.dataset.del) {
    deals = deals.filter((x) => x.id !== b.dataset.del); persistDeals(); dealMsg = 'Deal deleted.'; render();
  } else if (b.dataset.load) {
    const d = deals.find((x) => x.id === b.dataset.load);
    if (d) { Object.assign(S, d.inputs); touched.add('construction'); touched.add('pne'); syncInputs(); dealMsg = `Loaded "${d.name}" into the calculator.`; render(); }
  }
});
