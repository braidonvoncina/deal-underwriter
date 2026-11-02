const K = {
  state: 'OH', ptype: 'multi', price: 2100000, landPct: 20, area: 0,
  roll: [{ name: '1-bed units', count: 6, rent: 1350 }, { name: '2-bed units', count: 6, rent: 1600 }], rentBasis: 'm',
  extraIncome: 6000, vacancy: 5, creditLoss: 1, recovery: 0,
  propTax: 1.36, insurance: 12000, repairs: 14000, otherOpex: 10000, mgmt: 5, capex: 3, closing: 2,
  ltv: 65, rate: 7.25, amort: 30, ioYears: 0,
  hold: 7, rentGrowth: 3, expGrowth: 3, exitCap: 6.75, sellCost: 3,
  fs: 'single', otherIncome: 90000, stateTax: 2.75,
  reps: false, costSeg: false, segPct: 25, bonusPct: 100, exchange: false, boot: 0,
};
['sum', 'check', 'deals', 'noi', 'debt', 'adv'].forEach((id) => openSecs.add(id));
const TYPES = { multi: 'Multifamily', retail: 'Retail', office: 'Office', industrial: 'Industrial', mixed: 'Mixed use' };
const PRESETS = {
  multi: { vacancy: 5, creditLoss: 1, recovery: 0, mgmt: 5, rentBasis: 'm', landPct: 20 },
  retail: { vacancy: 7, creditLoss: 1, recovery: 85, mgmt: 4, rentBasis: 'y', landPct: 25 },
  office: { vacancy: 12, creditLoss: 1, recovery: 70, mgmt: 4, rentBasis: 'y', landPct: 20 },
  industrial: { vacancy: 5, creditLoss: 1, recovery: 90, mgmt: 3, rentBasis: 'y', landPct: 25 },
  mixed: { vacancy: 7, creditLoss: 1, recovery: 50, mgmt: 5, rentBasis: 'y', landPct: 20 },
};
const x2 = (n) => (isFinite(n) ? n.toFixed(2) + 'x' : 'n/a');
const pcn = (n, d = 2) => (isFinite(n) ? pc(n, d) : 'n/a');
let basis = K.rentBasis;

const TABS = [
  ['Property', [
    ['state', 'State', 'sel', Object.entries(US_STATES).map(([k, v]) => [k, v[0]]), '', 'Sets rough property tax and state tax defaults'],
    ['ptype', 'Property type', 'sel', Object.entries(TYPES)],
    ['price', 'Purchase price', '$', null, 'full'],
    ['area', 'Building area', 'sq ft', null, '', 'Optional, for price per sq ft'],
    ['landPct', 'Share that is land', '%', null, '', 'Land is not depreciated'],
  ]],
  ['Income', [
    ['roll', '', 'roll'],
    ['rentBasis', 'Rent is quoted', 'sel', [['m', 'Per month'], ['y', 'Per year']]],
    ['extraIncome', 'Other income /yr', '$', null, '', 'Laundry, parking, fees'],
    ['vacancy', 'Vacancy allowance', '%', null, '', 'Share of income lost to empty periods'],
    ['creditLoss', 'Bad debt allowance', '%', null, '', 'Unpaid rent'],
    ['recovery', 'Costs recovered', '%', null, 'full', 'Share of property tax, insurance and repairs tenants pay back (NNN leases). Use 0 for apartments.'],
  ]],
  ['Expenses', [
    ['propTax', 'Property tax', '%', null, '', 'Of price, each year'],
    ['insurance', 'Insurance /yr', '$'], ['repairs', 'Repairs and maintenance /yr', '$'],
    ['otherOpex', 'Other running costs /yr', '$', null, '', 'Utilities, trash, landscaping, payroll'],
    ['mgmt', 'Management fee', '%', null, '', 'Of collected income'],
    ['capex', 'Capital reserve', '%', null, '', 'Of income, for roofs, HVAC and tenant work'],
    ['closing', 'Closing costs', '%', null, 'full', 'Of price: legal, title, lender fees, due diligence'],
  ]],
  ['Financing', [
    ['ltv', 'Loan to value (LTV)', '%', null, '', 'Commercial lenders often cap this at 65 to 75%'],
    ['rate', 'Interest rate', '%', null, '', 'Start point is the Freddie Mac 30-year home loan average, 7.24% on 29 Oct 2026. Get commercial quotes'],
    ['amort', 'Amortization', 'sel', [[30, '30 years'], [25, '25 years'], [20, '20 years']], '', 'Years the payment is based on'],
    ['ioYears', 'Interest-only period', 'yrs'],
  ]],
  ['Exit', [
    ['hold', 'Hold period', 'yrs', null, '', 'Up to 30. Commercial loans often come due in 5 to 10'],
    ['exitCap', 'Exit cap rate', '%', null, '', 'Yield the buyer accepts when you sell'],
    ['rentGrowth', 'Rent growth /yr', '%'], ['expGrowth', 'Cost growth /yr', '%'],
    ['sellCost', 'Selling costs', '%', null, 'full', 'Broker and closing, as a share of the sale price'],
  ]],
  ['Tax', [
    ['fs', 'Filing status', 'sel', [['single', 'Single'], ['mfj', 'Married filing jointly']]],
    ['otherIncome', 'Your other income /yr', '$', null, '', 'Wages and other income, before deductions'],
    ['stateTax', 'State income tax', '%', null, '', 'Your marginal rate. Defaults are flat rates or mid-bracket guesses'],
    ['reps', 'Real estate professional', 'sel', [['0', 'No'], ['1', 'Yes']], '', 'Only if you work 750+ hours a year in real estate and more than half your working time. Removes the rental loss cap'],
    ['costSeg', 'Cost segregation study', 'sel', [['0', 'Off'], ['1', 'On']], '', 'Splits the building into short-life parts for faster deductions'],
    ['segPct', 'Share reclassified as short-life', '%', null, '', 'Often 15 to 30% of the building'],
    ['bonusPct', 'Bonus depreciation', '%', null, '', 'Share of short-life parts deducted in year 1'],
    ['exchange', '1031 exchange at sale', 'sel', [['0', 'Off'], ['1', 'On']], '', 'Defers the sale taxes into a replacement property'],
    ['boot', 'Cash taken out (taxable)', '$', null, '', 'Cash or other property you keep in an exchange'],
  ]],
];

function convertBasis() {
  const f = UC_X[basis] / UC_X[K.rentBasis];
  K.roll.forEach((r) => { r.rent = Math.round(r.rent * f * 100) / 100; });
  basis = K.rentBasis;
  buildRoll();
}

const form = createForm(TABS, K, {
  onChange: () => render(),
  onField: (k, touched) => {
    if (k === 'state') {
      const s = US_STATES[K.state];
      if (!touched.has('propTax')) K.propTax = s[1];
      if (!touched.has('stateTax')) K.stateTax = s[2];
    }
    if (k === 'ptype') {
      const p = PRESETS[K.ptype];
      ['vacancy', 'creditLoss', 'recovery', 'mgmt', 'landPct'].forEach((f) => { if (!touched.has(f)) K[f] = p[f]; });
      if (!touched.has('rentBasis')) { K.rentBasis = p.rentBasis; if (basis !== K.rentBasis) convertBasis(); }
    }
    if (k === 'rentBasis') convertBasis();
  },
});

function buildRoll() {
  const host = document.getElementById('roll-host');
  const lab = K.rentBasis === 'm' ? 'Rent each, per month' : 'Rent each, per year';
  host.innerHTML = `<label>Rent roll</label><div class="roll"><div class="rollrow rollhead"><span>Tenancy</span><span>Qty</span><span>${lab}</span><span></span></div>
    ${K.roll.map((r, i) => `<div class="rollrow"><input data-i="${i}" data-f="name" value="${esc(r.name)}" aria-label="Tenancy name" autocomplete="off">
      <input data-i="${i}" data-f="count" inputmode="numeric" value="${r.count}" aria-label="Quantity" autocomplete="off">
      <input data-i="${i}" data-f="rent" inputmode="decimal" value="${withCommas(String(r.rent))}" aria-label="Rent" autocomplete="off">
      <button class="rolldel" type="button" data-del="${i}" aria-label="Remove ${esc(r.name)}">×</button></div>`).join('')}</div>
    <div class="btns"><button class="btn" type="button" id="roll-add">Add a tenancy</button></div><small id="roll-total"></small>`;
  rollTotal();
}
function rollTotal() {
  const el = document.getElementById('roll-total');
  if (el) el.textContent = `${ucUnits(K)} units or tenancies, ${$(ucRent(K))} a year`;
}
document.getElementById('roll-host').addEventListener('input', (e) => {
  const el = e.target, i = +el.dataset.i, f = el.dataset.f;
  if (f === undefined) return;
  if (f === 'name') K.roll[i].name = el.value;
  else if (f === 'rent') K.roll[i].rent = formatInput(el);
  else K.roll[i].count = Math.max(0, parseInt(el.value, 10) || 0);
  rollTotal(); render();
});
document.getElementById('roll-host').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'roll-add' && K.roll.length < 12) K.roll.push({ name: 'New tenancy', count: 1, rent: 0 });
  else if (b.dataset.del !== undefined && K.roll.length > 1) K.roll.splice(+b.dataset.del, 1);
  else return;
  buildRoll(); render();
});

const deals = createDeals({
  key: 'deals-us-comm-v1', resultsEl: document.getElementById('results'), rerender: () => render(),
  defaultName: () => `${TYPES[K.ptype]} ${K.state} ${$(K.price)}`,
  snapshot: () => K,
  restore: (inp) => { Object.assign(K, inp); basis = K.rentBasis; buildRoll(); form.sync(); },
  view: (i) => {
    const c = uccalc(i);
    return { subtitle: `${US_STATES[i.state][0]} · ${TYPES[i.ptype]} · ${$(i.price)}`,
      rows: [['Net operating income', $(c.y1.noi)], ['Cap rate', pcn(c.cap), '', c.cap], ['DSCR', x2(c.dscr), c.dscr < 1.2 ? 'neg' : '', isFinite(c.dscr) ? c.dscr : 99],
        ['Cash-on-cash', pcn(c.coc), cls(c.coc), c.coc], [`IRR, ${c.N} yrs`, pcn(c.irr), cls(c.irr), isFinite(c.irr) ? c.irr : -99], ['Cash to close', $(c.cash)]],
      flags: ucflags(i, c) };
  },
});

const line = (l, v, sub, c = '') => `<tr><td>${l}</td><td class="r ${c}">${v}</td><td class="r">${sub === undefined ? '' : pcn(sub)}</td></tr>`;

function render() {
  const c = uccalc(K), y = c.y1, N = c.N, s = [];
  const pctOf = (v) => (y.egi ? v / y.egi * 100 : 0);

  s.push(sec('sum', 'Investment summary', `
    <div class="kpis">
      ${kpi('Net operating income', $(y.noi), 'Year 1, before loan and tax')}
      ${kpi('Cap rate', pcn(c.cap), 'NOI divided by price')}
      ${kpi('DSCR', x2(c.dscr), 'NOI divided by loan payments', c.dscr < 1.2 ? 'neg' : '')}
      ${kpi('Cash-on-cash', pcn(c.coc), 'Year 1 cash flow on cash in', cls(c.coc))}
      ${kpi(`IRR over ${N} years`, pcn(c.irr), 'After tax, including the sale', cls(c.irr))}
      ${kpi('Cash to close', $(c.cash), 'Down payment and closing costs')}
    </div>
    ${learn(`<p><code>NOI = income after vacancy + costs tenants repay - running costs</code>. It leaves out the loan, tax and depreciation, so it measures the property itself.</p>
      <p><code>Cap rate = NOI / price</code>. Compare it with the loan rate: a cap rate below the rate means borrowing lowers your return unless growth makes up the gap.</p>
      <p><code>DSCR = NOI / loan payments</code>; lenders usually want 1.25x or more. <code>Cash-on-cash = year 1 cash flow / cash in</code>. <code>IRR</code> is your yearly return counting each year's after-tax cash flow and the sale.</p>`)}`));

  s.push(sec('check', 'Deal check', flagList(ucflags(K, c))));
  s.push(sec('deals', 'Saved deals', deals.body()));

  s.push(sec('noi', 'Income and NOI, year 1', `
    <div class="tbl"><table><tr><th></th><th class="r">Per year</th><th class="r">% of income</th></tr>
      ${line('Gross rent', $(y.rent), pctOf(y.rent))}${line('Other income', $(y.other), pctOf(y.other))}${line('Vacancy allowance', $(-y.vac), pctOf(-y.vac))}${line('Bad debt allowance', $(-y.cred), pctOf(-y.cred))}
      <tr class="tot"><td>Effective income</td><td class="r">${$(y.egi)}</td><td class="r">100.00%</td></tr>
      ${line('Costs repaid by tenants', $(y.rec), pctOf(y.rec))}
      ${[['Property tax', y.ptax], ['Insurance', y.ins], ['Repairs and maintenance', y.rep], ['Other running costs', y.otherOp], ['Management fee', y.mgmt]].map(([l, v]) => line(l, $(-v), pctOf(-v))).join('')}
      <tr class="tot"><td>Net operating income</td><td class="r ${cls(y.noi)}">${$(y.noi)}</td><td class="r">${pcn(pctOf(y.noi))}</td></tr>
      ${line('Capital reserve', $(-y.capex), pctOf(-y.capex))}${line('Loan payments', $(-y.ds), pctOf(-y.ds))}
      <tr class="tot"><td>Cash flow before tax</td><td class="r ${cls(y.cf)}">${$(y.cf)}</td><td class="r">${pcn(pctOf(y.cf))}</td></tr>
      ${line('Tax (negative means a saving)', $(-y.tax), pctOf(-y.tax))}
      <tr class="tot"><td>Cash flow after tax</td><td class="r ${cls(y.cfAfter)}">${$(y.cfAfter)}</td><td class="r">${pcn(pctOf(y.cfAfter))}</td></tr></table></div>
    ${learn(`<p>Rent you could collect, less vacancy and bad debt, plus any costs tenants repay, less running costs, gives NOI. The loan, a reserve for big repairs and tax come after NOI.</p>
      <p>Tax is NOI minus loan interest minus depreciation (${c.life} years, straight line, on the building share of the price plus closing costs), taxed at your rate. Rental losses are limited by the passive loss rules; unused ones carry forward.</p>`)}`));

  s.push(sec('debt', 'Debt and lender tests', `
    <div class="kpis">
      ${kpi('Loan amount', $(c.loan), pc(K.ltv, 0) + ' of price')}
      ${kpi('DSCR', x2(c.dscr), 'Year 1 payments', c.dscr < 1.2 ? 'neg' : '')}
      ${kpi('Interest cover', x2(c.icr), 'NOI divided by interest')}
      ${kpi('Debt yield', pcn(c.debtYield), 'NOI divided by the loan')}
      ${kpi('Break-even occupancy', pcn(c.breakEven, 0), 'Rented share needed to cover all costs')}
    </div>
    <div class="two"><div class="col"><h4>Payments</h4>
      ${K.ioYears > 0 ? row(`Years 1 to ${K.ioYears}, interest only`, $(c.ioYear) + ' a year') : ''}
      ${row('Principal and interest', $(c.piYear) + ' a year')}${row('DSCR on that payment', x2(c.dscrPI), c.dscrPI < 1.2 ? 'neg' : '')}
      ${row(`Loan balance after ${N} years`, $(c.last.bal))}</div></div>
    ${learn(`<p><code>DSCR</code> looks at all loan payments, <code>interest cover</code> only at interest, and <code>debt yield</code> ignores the rate entirely, so a long interest-only period cannot flatter it. <code>Break-even occupancy = (costs - recoveries + loan payments + reserve) / full rent</code>; lower is safer.</p>
      <p>Commercial loans often balloon: payments are set over 25 to 30 years but the whole balance falls due in 5 to 10, so you must refinance or sell. If that balance is large, a rate rise or fall in value at that moment can force a bad sale.</p>`)}`));

  s.push(sec('buy', 'Purchase and metrics', `
    <div class="two">
      <div class="col"><h4>Cash to close</h4>${row('Price', $(K.price))}${row('Closing costs', $(c.closing))}${row('Less loan', $(-c.loan))}${row('<b>Your cash</b>', $(c.cash))}</div>
      <div class="col"><h4>Price metrics</h4>${row('Cap rate', pcn(c.cap))}${row('Gross rent multiplier', c.grm.toFixed(1) + 'x')}${row('Price per unit', c.units ? $(c.perUnit) : 'n/a')}${row('Price per sq ft', c.perSf ? $(c.perSf) : 'Add area')}${row('Running costs share', pcn(c.opexRatio, 1))}</div>
    </div>
    ${learn(`<p><code>Gross rent multiplier = price / gross rent</code> is a quick way to compare buildings. Price per unit or per sq ft shows whether you are paying more than similar buildings nearby.</p>`)}`));

  s.push(sec('tax', 'Tax and depreciation', `
    <div class="two">
      <div class="col"><h4>Year 1</h4>${row('NOI', $(y.noi))}${row('Less loan interest', $(-y.int))}${row(`Less depreciation (${c.life} yrs)`, $(-c.dep))}${row('<b>Taxable income</b>', $(y.taxable), cls(y.taxable))}${row('Tax effect (negative is a saving)', $(y.tax))}</div>
      <div class="col"><h4>Your position</h4>${row('Federal bracket', pc(c.marginal * 100, 0))}${row('Rental loss you can use', isFinite(c.passive) ? $(c.passive) : 'No limit')}${row(`Unused losses at year ${N}`, $(c.last.susp))}</div>
    </div>
    ${learn(`<p>Apartment buildings depreciate over 27.5 years and commercial buildings over 39, straight line, a deduction on paper only. Depreciation is taken back at sale (see below). Cost segregation and bonus depreciation can speed deductions up but are not modelled here.</p>
      <p>Rental losses are "passive". A $25,000 allowance for active owners is cut by 50 cents per dollar of income over $100,000. This calculator treats your income as your adjusted gross income, and ignores the 20% pass-through deduction and real estate professional status.</p>`)}`));

  s.push(sec('proj', `${N} year projection`, `
    <div class="tbl"><table><tr><th>Year</th><th class="r">NOI</th><th class="r">Cash flow</th><th class="r">After tax</th><th class="r">Loan balance</th></tr>
      ${c.rows.map((r) => `<tr><td>${r.t}</td><td class="r">${$(r.noi)}</td><td class="r ${cls(r.cf)}">${$(r.cf)}</td><td class="r ${cls(r.cfAfter)}">${$(r.cfAfter)}</td><td class="r">${$(r.bal)}</td></tr>`).join('')}</table></div>
    ${learn(`<p>Rent grows ${K.rentGrowth}% and costs ${K.expGrowth}% a year. Loan payments stay fixed, so rent growth is what improves a tight deal.</p>`)}`));

  s.push(sec('exit', `Sale after ${N} years`, `
    <div class="kpis">
      ${kpi('Sale price', $(c.value), `Year ${N + 1} NOI ÷ ${c.exitCap}% exit cap`)}
      ${kpi('Cash after tax', $(c.net), 'After loan, costs and taxes', cls(c.net))}
      ${kpi('IRR', pcn(c.irr), 'After tax', cls(c.irr))}
      ${kpi('Equity multiple', x2(c.multiple), 'Cash back ÷ cash in')}
    </div>
    <div class="two"><div class="col"><h4>Sale</h4>${row('Sale price', $(c.value))}${row(`Selling costs (${K.sellCost}%)`, $(-c.sellCost))}${row('Repay loan', $(-c.last.bal))}${row('Taxes on the sale', $(-c.saleTax))}${row('<b>Cash you keep</b>', $(c.net))}</div>
    <div class="col"><h4>Taxes on the sale</h4>${row('Gain on sale', $(c.gain))}${row('Depreciation recapture', $(c.recap))}${row('Recapture tax (25% cap on building)', $(c.recapTax))}${row('Capital gains tax (0/15/20%)', $(c.ltTax))}${row('Investment income tax (3.8%)', $(c.niitSale))}${row('State income tax', $(c.stateSale))}${c.suspSaving ? row('Released passive losses', $(-c.suspSaving)) : ''}</div></div>
    ${learn(`<p>A buyer values the building on the NOI it will earn next, so <code>sale price = next year's NOI / exit cap rate</code>. A small change in the exit cap rate moves the price a lot, which is why the stress tests flex it.</p>
      <p>Gain = sale price - selling costs - (what you paid and spent - depreciation claimed). The part equal to depreciation claimed is taxed at your ordinary rate up to 25%; the rest at 0, 15 or 20%, plus a 3.8% investment income tax above $200,000 (single) or $250,000 (joint). A 1031 exchange, which can defer these taxes, is not modelled. Federal figures: ${US_TAX.asOf}.</p>`)}`));

  const cs = K.costSeg, ex = K.exchange;
  if (cs || ex) {
    const rowsA = [];
    let body = '';
    if (cs) {
      const p = uccalc({ ...K, costSeg: false });
      const side = (z, t) => `<div class="col"><h4>${t}</h4>${row('Year 1 depreciation', $(z.dep))}${row('Year 1 taxable income', $(z.y1.taxable))}${row('Year 1 tax effect', $(z.y1.tax))}${row('Suspended losses', $(z.last.susp))}${row('Recapture tax at sale', $(z.recapTax))}${row('Cash kept at sale', $(z.net))}${row('IRR after tax', pcn(z.irr), cls(z.irr))}</div>`;
      body += `<h4>Cost segregation</h4><div class="two">${side(p, 'Without')}${side(c, 'With')}</div>`;
    }
    if (ex) {
      body += `<h4>1031 exchange</h4><div class="two"><div class="col">${row('Gain on sale', $(c.gain))}${row('Gain deferred', $(c.deferredGain))}${row('Gain taxed now (boot)', $(c.recognized))}</div>
        <div class="col">${row('Sale taxes now', $(c.saleTax))}${row('<b>Tax deferred, still owed later</b>', $(c.deferred))}</div></div>`;
    }
    s.push(sec('adv', 'Cost segregation and 1031 effects', body + learn(`<p>This compares the same deal with the switch off. Cost segregation moves deductions earlier, but rental losses above your allowance are suspended, and the extra depreciation comes back as ordinary-rate tax when you sell. A 1031 exchange defers sale taxes: the IRR shown assumes you keep the equity without paying them, so treat it as flattering. See Tax topics to learn.</p>`)));
  }
  const rowsS = UCSTRESS.map(([name, o]) => ({ name, z: uccalc(K, o) }));
  s.push(sec('stress', 'Stress tests', `
    <div class="tbl"><table><tr><th>Scenario</th><th class="r">DSCR</th><th class="r">Cash-on-cash</th><th class="r">IRR</th><th class="r">Year 1 cash flow</th></tr>
      ${rowsS.map(({ name, z }) => `<tr><td>${name}</td><td class="r ${z.dscr < 1.2 ? 'neg' : ''}">${x2(z.dscr)}</td><td class="r ${cls(z.coc)}">${pcn(z.coc)}</td><td class="r ${cls(z.irr)}">${pcn(z.irr)}</td><td class="r ${cls(z.y1.cf)}">${$(z.y1.cf)}</td></tr>`).join('')}</table></div>
    ${learn(`<p>Each line changes one thing and reruns the deal. Commercial deals can look fine in the base case and fall apart under a small change because the loan is large compared with income. Look for the scenario that pushes DSCR under 1.2x or IRR below zero. Rate lines show a higher rate on the loan, which matters at refinance.</p>`)}`));

  s.push(usTopics());

  document.getElementById('results').innerHTML = s.join('');
  document.getElementById('pinbar').innerHTML =
    `<div><span>NOI</span><b>${$(y.noi)}</b></div><div><span>DSCR</span><b class="${c.dscr < 1.2 ? 'neg' : ''}">${x2(c.dscr)}</b></div><div><span>IRR</span><b class="${cls(c.irr)}">${pcn(c.irr, 1)}</b></div>`;
}

buildRoll();
render();
trackSections(document.getElementById('results'));
