const C = {
  state: 'VIC', ptype: 'multi', price: 2600000, landValue: 1300000, area: 0,
  roll: [{ name: '1-bed units', count: 4, rent: 520 }, { name: '2-bed units', count: 4, rent: 600 }], rentBasis: 'w',
  otherIncome: 4000, vacancy: 5, creditLoss: 1, recovery: 0,
  rates: 9000, insurance: 7500, repairs: 12000, otherOpex: 8000, mgmtPct: 6, capexPct: 3, acq: 40000,
  lvr: 65, rate: 6.9, term: 25, ioYears: 3,
  hold: 5, rentGrowth: 3, expGrowth: 3, exitCap: 6.75, sellCost: 2,
  owner: 'ind', tax: 37, construction: 1092000, pne: 104000,
};
['sum', 'check', 'deals', 'noi', 'debt'].forEach((id) => openSecs.add(id));
const TYPES = { multi: 'Multifamily', retail: 'Retail', office: 'Office', industrial: 'Industrial', mixed: 'Mixed use' };
const PRESETS = {
  multi: { vacancy: 5, creditLoss: 1, recovery: 0, mgmtPct: 6, rentBasis: 'w' },
  retail: { vacancy: 8, creditLoss: 1, recovery: 80, mgmtPct: 4, rentBasis: 'y' },
  office: { vacancy: 12, creditLoss: 1, recovery: 70, mgmtPct: 3, rentBasis: 'y' },
  industrial: { vacancy: 6, creditLoss: 1, recovery: 90, mgmtPct: 3, rentBasis: 'y' },
  mixed: { vacancy: 7, creditLoss: 1, recovery: 50, mgmtPct: 5, rentBasis: 'y' },
};
const x2 = (n) => (isFinite(n) ? n.toFixed(2) + 'x' : 'n/a');
const pcn = (n) => (isFinite(n) ? pc(n) : 'n/a');
let basis = C.rentBasis;

const TABS = [
  ['Property', [
    ['state', 'State / territory', 'sel', ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => [s, s])],
    ['ptype', 'Property type', 'sel', Object.entries(TYPES)],
    ['price', 'Purchase price', '$', null, 'full', 'Price before GST. Check how GST applies to the sale.'],
    ['landValue', 'Land value', '$', null, '', 'Used to estimate land tax'],
    ['area', 'Floor area', 'm²', null, '', 'Optional, for price per m²'],
  ]],
  ['Income', [
    ['roll', '', 'roll'],
    ['rentBasis', 'Rent is quoted', 'sel', [['w', 'Per week'], ['m', 'Per month'], ['y', 'Per year']]],
    ['otherIncome', 'Other income /yr', '$', null, '', 'Parking, laundry, signage'],
    ['vacancy', 'Vacancy allowance', '%', null, '', 'Share of income lost to empty periods'],
    ['creditLoss', 'Bad debt allowance', '%', null, '', 'Unpaid rent'],
    ['recovery', 'Outgoings recovered', '%', null, 'full', 'Share of rates, land tax, insurance and repairs that tenants pay back. Use 0 for apartments.'],
  ]],
  ['Expenses', [
    ['rates', 'Council rates and water /yr', '$'], ['insurance', 'Insurance /yr', '$'],
    ['repairs', 'Repairs and maintenance /yr', '$'], ['otherOpex', 'Other running costs /yr', '$', null, '', 'Cleaning, garbage, utilities'],
    ['mgmtPct', 'Management fee', '%', null, '', 'Of collected income'],
    ['capexPct', 'Capital reserve', '%', null, '', 'Of income, for big repairs'],
    ['acq', 'Acquisition costs', '$', null, 'full', 'Legal, due diligence, valuation, loan fees'],
  ]],
  ['Financing', [
    ['lvr', 'Loan to value (LVR)', '%', null, '', 'Commercial lenders often cap this at 60 to 70%'],
    ['rate', 'Interest rate', '%'], ['term', 'Loan term', 'yrs'], ['ioYears', 'Interest-only period', 'yrs'],
  ]],
  ['Exit', [
    ['hold', 'Hold period', 'yrs', null, '', 'Up to 10'],
    ['exitCap', 'Exit cap rate', '%', null, '', 'Yield the buyer accepts when you sell'],
    ['rentGrowth', 'Rent growth /yr', '%'], ['expGrowth', 'Cost growth /yr', '%'],
    ['sellCost', 'Selling costs', '%', null, 'full', 'Agent, legal and marketing, as a share of the sale price'],
  ]],
  ['Tax', [
    ['owner', 'Who owns it', 'sel', [['ind', 'Individual (50% CGT discount)'], ['smsf', 'Super fund (one-third CGT discount)'], ['co', 'Company (no CGT discount)']], 'full'],
    ['tax', 'Tax rate on the income', 'sel', [['0', 'Tax-free (0%)'], ['15', 'Super fund (15%) or $18,201 to $45,000'], ['25', 'Company base rate (25%)'], ['30', 'Company 30% or $45,001 to $135,000'],
      ['37', '$135,001 to $190,000 (37%)'], ['45', '$190,001+ (45%)']], 'full', 'The Medicare levy is not included'],
    ['construction', 'Building construction value', '$', null, '', 'Capital works deduction, 2.5% a year'],
    ['pne', 'Plant and equipment', '$', null, '', 'Deducted at 20% of the remaining value'],
  ]],
];

function convertBasis() {
  const f = RENT_X[basis] / RENT_X[C.rentBasis];
  C.roll.forEach((r) => { r.rent = Math.round(r.rent * f * 100) / 100; });
  basis = C.rentBasis;
  buildRoll();
}
const round1k = (n) => Math.round(n / 1000) * 1000;

const form = createForm(TABS, C, {
  onChange: () => render(),
  onField: (k, touched) => {
    if (k === 'ptype') {
      const p = PRESETS[C.ptype];
      ['vacancy', 'creditLoss', 'recovery', 'mgmtPct'].forEach((f) => { if (!touched.has(f)) C[f] = p[f]; });
      if (!touched.has('rentBasis')) { C.rentBasis = p.rentBasis; if (basis !== C.rentBasis) convertBasis(); }
    }
    if (k === 'rentBasis') convertBasis();
    if (k === 'price') {
      if (!touched.has('landValue')) C.landValue = round1k(C.price * 0.5);
      if (!touched.has('construction')) C.construction = round1k(C.price * 0.42);
      if (!touched.has('pne')) C.pne = round1k(C.price * 0.04);
    }
  },
});

function buildRoll() {
  const host = document.getElementById('roll-host');
  const lab = { w: 'Rent each, per week', m: 'Rent each, per month', y: 'Rent each, per year' }[C.rentBasis];
  host.innerHTML = `<label>Rent roll</label><div class="roll"><div class="rollrow rollhead"><span>Tenancy</span><span>Qty</span><span>${lab}</span><span></span></div>
    ${C.roll.map((r, i) => `<div class="rollrow"><input data-i="${i}" data-f="name" value="${esc(r.name)}" aria-label="Tenancy name" autocomplete="off">
      <input data-i="${i}" data-f="count" inputmode="numeric" value="${r.count}" aria-label="Quantity" autocomplete="off">
      <input data-i="${i}" data-f="rent" inputmode="decimal" value="${withCommas(String(r.rent))}" aria-label="Rent" autocomplete="off">
      <button class="rolldel" type="button" data-del="${i}" aria-label="Remove ${esc(r.name)}">×</button></div>`).join('')}</div>
    <div class="btns"><button class="btn" type="button" id="roll-add">Add a tenancy</button></div><small id="roll-total"></small>`;
  rollTotal();
}
function rollTotal() {
  const el = document.getElementById('roll-total');
  if (el) el.textContent = `${unitCount(C)} units or tenancies, ${$(annualRent(C))} a year`;
}
document.getElementById('roll-host').addEventListener('input', (e) => {
  const el = e.target, i = +el.dataset.i, f = el.dataset.f;
  if (f === undefined) return;
  if (f === 'name') C.roll[i].name = el.value;
  else if (f === 'rent') C.roll[i].rent = formatInput(el);
  else C.roll[i].count = Math.max(0, parseInt(el.value, 10) || 0);
  rollTotal(); render();
});
document.getElementById('roll-host').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'roll-add' && C.roll.length < 12) C.roll.push({ name: 'New tenancy', count: 1, rent: 0 });
  else if (b.dataset.del !== undefined && C.roll.length > 1) C.roll.splice(+b.dataset.del, 1);
  else return;
  buildRoll(); render();
});

const deals = createDeals({
  key: 'deals-comm-au-v1', resultsEl: document.getElementById('results'), rerender: () => render(),
  defaultName: () => `${TYPES[C.ptype]} ${C.state} ${$(C.price)}`,
  snapshot: () => C,
  restore: (inp) => { Object.assign(C, inp); basis = C.rentBasis; buildRoll(); form.sync(); },
  view: (i) => {
    const c = ccalc(i);
    return { subtitle: `${i.state} · ${TYPES[i.ptype]} · ${$(i.price)}`,
      rows: [['Net operating income', $(c.y1.noi)], ['Cap rate', pcn(c.cap), '', c.cap], ['DSCR', x2(c.dscr), c.dscr < 1.2 ? 'neg' : '', isFinite(c.dscr) ? c.dscr : 99],
        ['Cash-on-cash', pcn(c.coc), cls(c.coc), c.coc], [`IRR, ${c.N} yrs`, pcn(c.irr), cls(c.irr), isFinite(c.irr) ? c.irr : -99], ['Cash to settle', $(c.equity)]],
      flags: cflags(i, c) };
  },
});

const line = (label, v, sub) => `<tr><td>${label}</td><td class="r">${v}</td><td class="r">${sub === undefined ? '' : pcn(sub)}</td></tr>`;

function render() {
  const c = ccalc(C), y = c.y1, N = c.N;
  const sections = [];

  sections.push(sec('sum', 'Investment summary', `
    <div class="kpis">
      ${kpi('Net operating income', $(y.noi), 'Year 1, before loan and tax')}
      ${kpi('Cap rate', pcn(c.cap), 'NOI divided by price')}
      ${kpi('DSCR', x2(c.dscr), 'NOI divided by repayments', c.dscr < 1.2 ? 'neg' : '')}
      ${kpi('Cash-on-cash', pcn(c.coc), 'Year 1 cash flow on your cash in', cls(c.coc))}
      ${kpi(`IRR over ${N} years`, pcn(c.irr), 'After tax, including the sale', cls(c.irr))}
      ${kpi('Cash to settle', $(c.equity), 'Deposit, duty and costs')}
    </div>
    ${learn(`<p><code>NOI = income after vacancy + recoveries - running costs</code>. It leaves out the loan, tax and depreciation, so it measures the property itself.</p>
      <p><code>Cap rate = NOI / price</code>. Compare it with the loan rate: a cap rate below the interest rate means borrowing lowers your return unless growth makes up the gap.</p>
      <p><code>DSCR = NOI / loan repayments</code>. Lenders usually want 1.25x to 1.5x or more.</p>
      <p><code>Cash-on-cash = year 1 cash flow / cash you put in</code>. <code>IRR</code> is your yearly return on that cash, counting every year's cash flow and the sale.</p>`)}`));

  sections.push(sec('check', 'Deal check', flagList(cflags(C, c))));
  sections.push(sec('deals', 'Saved deals', deals.body()));

  const pctOf = (v) => (y.egi ? v / y.egi * 100 : 0);
  const rowsNoi = [
    ['Gross rent', y.rent], ['Other income', y.other], ['Vacancy allowance', -y.vac], ['Bad debt allowance', -y.cred],
  ];
  sections.push(sec('noi', 'Income and NOI, year 1', `
    <div class="tbl"><table><tr><th></th><th class="r">Per year</th><th class="r">% of income</th></tr>
      ${rowsNoi.map(([l, v]) => line(l, $(v, false), pctOf(v))).join('')}
      <tr class="tot"><td>Effective income</td><td class="r">${$(y.egi)}</td><td class="r">100.00%</td></tr>
      ${line('Outgoings recovered from tenants', $(y.rec), pctOf(y.rec))}
      ${[['Council rates and water', y.rates], ['Land tax (estimate)', y.lt], ['Insurance', y.insurance], ['Repairs and maintenance', y.repairs], ['Other running costs', y.otherOp], ['Management fee', y.mgmt]]
        .map(([l, v]) => line(l, $(-v), pctOf(-v))).join('')}
      <tr class="tot"><td>Net operating income</td><td class="r ${cls(y.noi)}">${$(y.noi)}</td><td class="r">${pcn(pctOf(y.noi))}</td></tr>
      ${line('Capital reserve', $(-y.capex), pctOf(-y.capex))}${line('Loan repayments', $(-y.ds), pctOf(-y.ds))}
      <tr class="tot"><td>Cash flow before tax</td><td class="r ${cls(y.cf)}">${$(y.cf)}</td><td class="r">${pcn(pctOf(y.cf))}</td></tr>
      ${line('Tax (negative means a tax saving)', $(-y.tax), pctOf(-y.tax))}
      <tr class="tot"><td>Cash flow after tax</td><td class="r ${cls(y.cfAfter)}">${$(y.cfAfter)}</td><td class="r">${pcn(pctOf(y.cfAfter))}</td></tr></table></div>
    ${learn(`<p>Read it top to bottom: rent you could collect, less vacancy and bad debt, plus any costs tenants pay back, less running costs, gives NOI. The loan, a reserve for big repairs and tax come after NOI.</p>
      <p>Land tax is estimated from the land value you entered using the same simplified state tables as the residential calculator, so check it against a real land tax assessment. Tax is the building and equipment deductions plus loan interest taken off NOI, taxed at your rate; a loss is assumed to save tax against other income.</p>`)}`));

  sections.push(sec('debt', 'Debt and lender tests', `
    <div class="kpis">
      ${kpi('Loan amount', $(c.loan), pc(C.lvr, 0) + ' of price')}
      ${kpi('DSCR', x2(c.dscr), 'Year 1 repayments', c.dscr < 1.2 ? 'neg' : '')}
      ${kpi('Interest cover (ICR)', x2(c.icr), 'NOI divided by interest')}
      ${kpi('Debt yield', pcn(c.debtYield), 'NOI divided by the loan')}
      ${kpi('Break-even occupancy', pcn(c.breakEven, 1).replace(/(\.\d)\d?%/, '$1%'), 'Rented share needed to cover all costs')}
    </div>
    <div class="two"><div class="col"><h4>Repayments</h4>
      ${row(`Years 1 to ${Math.min(C.ioYears, C.term)}${C.ioYears > 0 ? ', interest only' : ''}`, $(c.ioYear) + ' a year')}
      ${row('Once principal is repaid', $(c.piYear) + ' a year')}${row('DSCR on that higher amount', x2(c.dscrPI), c.dscrPI < 1.2 ? 'neg' : '')}
      ${row(`Loan balance after ${N} years`, $(c.bal))}</div></div>
    ${learn(`<p>Lenders test a deal in several ways. <code>DSCR</code> looks at all repayments, <code>ICR</code> only at interest, and <code>debt yield</code> ignores the rate entirely, so it cannot be gamed by a long interest-only period.</p>
      <p><code>Break-even occupancy = (running costs - recoveries + repayments) / full rent</code>. Lower is safer.</p>
      <p>Interest-only years flatter DSCR. Always look at the DSCR on the higher repayment too.</p>`)}`));

  sections.push(sec('buy', 'Purchase and metrics', `
    <div class="two">
      <div class="col"><h4>Cash to settle</h4>${row('Price', $(C.price))}${row('Stamp duty', $(c.duty))}${row('Acquisition costs', $(C.acq))}${row('Less loan', $(-c.loan))}${row('<b>Your cash</b>', $(c.equity))}</div>
      <div class="col"><h4>Price metrics</h4>${row('Cap rate', pcn(c.cap))}${row('Gross rent multiplier', c.grm.toFixed(1) + 'x')}${row('Price per unit', c.units ? $(c.perUnit) : 'n/a')}${row('Price per m²', c.perSqm ? $(c.perSqm) : 'Add floor area')}${row('Running costs of income', pcn(c.opexRatio, 1))}</div>
    </div>
    ${learn(`<p><code>Gross rent multiplier = price / gross rent</code>, a quick way to compare buildings. Price per unit or per m² shows whether you are paying more than similar buildings nearby.</p>`)}`));

  sections.push(sec('proj', `${N} year projection`, `
    <div class="tbl"><table><tr><th></th>${c.rows.map((r) => `<th class="r">Yr ${r.t}</th>`).join('')}</tr>
      ${[['NOI', 'noi'], ['Loan repayments', 'ds'], ['Cash flow before tax', 'cf'], ['Tax', 'tax'], ['Cash flow after tax', 'cfAfter'], ['Loan balance', 'bal']]
        .map(([l, k]) => `<tr><td>${l}</td>${c.rows.map((r) => `<td class="r ${k === 'cf' || k === 'cfAfter' ? cls(r[k]) : ''}">${$(k === 'tax' ? -r[k] : k === 'ds' ? -r[k] : r[k])}</td>`).join('')}</tr>`).join('')}</table></div>
    ${learn(`<p>Rent grows ${C.rentGrowth}% and costs ${C.expGrowth}% a year. Loan repayments stay fixed, so in a deal that is tight today, rent growth is what improves cash flow. Interest-only years show a flat balance; after that it falls.</p>`)}`));

  sections.push(sec('exit', `Sale after ${N} years`, `
    <div class="kpis">
      ${kpi('Sale price', $(c.sale), `Year ${N + 1} NOI ÷ ${c.exitCap}% exit cap`)}
      ${kpi('Net proceeds', $(c.net), 'After loan, costs and tax', cls(c.net))}
      ${kpi('IRR', pcn(c.irr), 'After tax', cls(c.irr))}
      ${kpi('Equity multiple', x2(c.multiple), 'Cash back ÷ cash in')}
    </div>
    <div class="two"><div class="col"><h4>Sale</h4>${row('Sale price', $(c.sale))}${row(`Selling costs (${C.sellCost}%)`, $(-c.costs))}${row('Repay loan', $(-c.bal))}${row('Capital gains tax', $(-c.cgt))}${row('<b>Net proceeds</b>', $(c.net))}</div>
    <div class="col"><h4>Capital gains tax</h4>${row('Capital gain', $(c.gain))}${row('Discount', c.disc ? pc(c.disc * 100, 0) : 'None')}${row('Taxable gain', $(c.gain * (1 - c.disc)))}${row('Tax rate', pc(C.tax, 1))}</div></div>
    ${learn(`<p>A buyer values the building on the NOI they will earn next, so <code>sale price = next year's NOI / exit cap rate</code>. A small change in the exit cap rate moves the price a lot, which is why the stress tests below flex it.</p>
      <p>Capital gain = sale price - selling costs - (price + duty + acquisition costs - capital works deductions claimed). Individuals and trusts get a 50% discount after 12 months, SMSFs one third, companies none.</p>`)}`));

  const rowsS = STRESS.map(([name, o]) => ({ name, s: ccalc(C, o) }));
  sections.push(sec('stress', 'Stress tests', `
    <div class="tbl"><table><tr><th>Scenario</th><th class="r">DSCR</th><th class="r">Cash-on-cash</th><th class="r">IRR</th><th class="r">Year 1 cash flow</th></tr>
      ${rowsS.map(({ name, s }) => `<tr><td>${name}</td><td class="r ${s.dscr < 1.2 ? 'neg' : ''}">${x2(s.dscr)}</td><td class="r ${cls(s.coc)}">${pcn(s.coc)}</td><td class="r ${cls(s.irr)}">${pcn(s.irr)}</td><td class="r ${cls(s.y1.cf)}">${$(s.y1.cf)}</td></tr>`).join('')}</table></div>
    ${learn(`<p>Each line changes one thing and reruns the whole deal. Commercial deals can look fine in the base case and fall apart under a small change, because the loan is large compared with the income. Look for the scenario that pushes DSCR under 1.2x or IRR below zero.</p>`)}`));

  document.getElementById('results').innerHTML = sections.join('');
  document.getElementById('pinbar').innerHTML =
    `<div><span>NOI</span><b>${$(y.noi)}</b></div><div><span>DSCR</span><b class="${c.dscr < 1.2 ? 'neg' : ''}">${x2(c.dscr)}</b></div><div><span>IRR</span><b class="${cls(c.irr)}">${pcn(c.irr, 1)}</b></div>`;
}

buildRoll();
render();
trackSections(document.getElementById('results'));
