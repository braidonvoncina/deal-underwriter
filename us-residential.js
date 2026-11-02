const U = {
  state: 'OH', price: 275000, down: 25, rate: 6.75, term: 30, closing: 3, rehab: 0,
  rent: 2400, vacancy: 5, propTax: 1.4, insurance: 1500, hoa: 0, utilities: 0, maint: 8, capex: 5, mgmt: 8,
  appreciation: 3, rentGrowth: 3, expGrowth: 3, hold: 10, sellCost: 6,
  fs: 'single', otherIncome: 90000, stateTax: 3.5, landPct: 20,
  costSeg: false, segPct: 25, bonusPct: 100, exchange: false, boot: 0,
};
['sum', 'check', 'deals', 'cash', 'adv'].forEach((id) => openSecs.add(id));
const x2 = (n) => (isFinite(n) ? n.toFixed(2) : 'n/a');
const pcn = (n, d = 2) => (isFinite(n) ? pc(n, d) : 'n/a');

const TABS = [
  ['Property', [
    ['state', 'State', 'sel', Object.entries(US_STATES).map(([k, v]) => [k, v[0]]), '', 'Sets rough property tax and state income tax defaults. Edit them.'],
    ['price', 'Purchase price', '$', null, ''],
    ['rehab', 'Repairs at purchase', '$', null, '', 'Cash spent to get it rent-ready'],
    ['rent', 'Rent per month', '$', null, 'full'],
  ]],
  ['Loan', [
    ['down', 'Down payment', '%', null, '', 'Investment loans usually need 15 to 25%'],
    ['rate', 'Interest rate', '%', null, '', 'Check today\'s rate; investor loans cost more'],
    ['term', 'Loan term', 'sel', [[30, '30 years fixed'], [20, '20 years fixed'], [15, '15 years fixed']]],
    ['closing', 'Closing costs', '%', null, '', 'Of price: lender fees, title, appraisal. Roughly 2 to 4%'],
  ]],
  ['Expenses', [
    ['vacancy', 'Vacancy', '%', null, '', 'Share of rent lost to empty months'],
    ['propTax', 'Property tax', '%', null, '', 'Of price, each year'],
    ['insurance', 'Insurance /yr', '$'], ['hoa', 'HOA /month', '$'],
    ['utilities', 'Utilities /month', '$', null, '', 'Only what you pay'],
    ['maint', 'Maintenance', '%', null, '', 'Of rent. Routine repairs'],
    ['capex', 'Capital reserve', '%', null, '', 'Of rent. Roof, HVAC, appliances'],
    ['mgmt', 'Property management', '%', null, '', 'Of collected rent'],
  ]],
  ['Growth & sale', [
    ['hold', 'Hold period', 'yrs', null, '', 'Up to 30'],
    ['appreciation', 'Price growth /yr', '%'], ['rentGrowth', 'Rent growth /yr', '%'], ['expGrowth', 'Cost growth /yr', '%'],
    ['sellCost', 'Selling costs', '%', null, 'full', 'Agent commissions and closing, as a share of the sale price'],
  ]],
  ['Tax', [
    ['fs', 'Filing status', 'sel', [['single', 'Single'], ['mfj', 'Married filing jointly']]],
    ['otherIncome', 'Your other income /yr', '$', null, '', 'Wages and other income, before deductions'],
    ['stateTax', 'State income tax', '%', null, '', 'Rough rate on the income'],
    ['landPct', 'Share that is land', '%', null, '', 'Land is not depreciated. Use the county assessor split'],
    ['costSeg', 'Cost segregation study', 'sel', [['0', 'Off'], ['1', 'On']], '', 'Splits the building into short-life parts for faster deductions'],
    ['segPct', 'Share reclassified as short-life', '%', null, '', 'Often 15 to 30% of the building'],
    ['bonusPct', 'Bonus depreciation', '%', null, '', 'Share of short-life parts deducted in year 1'],
    ['exchange', '1031 exchange at sale', 'sel', [['0', 'Off'], ['1', 'On']], '', 'Defers the sale taxes into a replacement property'],
    ['boot', 'Cash taken out (taxable)', '$', null, '', 'Cash or other property you keep in an exchange'],
  ]],
];

const form = createForm(TABS, U, {
  onChange: () => render(),
  onField: (k, touched) => {
    if (k === 'state') {
      const s = US_STATES[U.state];
      if (!touched.has('propTax')) U.propTax = s[1];
      if (!touched.has('stateTax')) U.stateTax = s[2];
    }
  },
});

const deals = createDeals({
  key: 'deals-us-res-v1', resultsEl: document.getElementById('results'), rerender: () => render(),
  defaultName: () => `${U.state} ${$(U.price)} rental`,
  snapshot: () => U,
  restore: (inp) => { Object.assign(U, inp); form.sync(); },
  view: (i) => {
    const c = ucalc(i);
    return { subtitle: `${US_STATES[i.state][0]} · ${$(i.price)} · ${i.down}% down`,
      rows: [['Cash flow / month', $(c.mo.cf), cls(c.mo.cf), c.mo.cf], ['Cap rate', pcn(c.cap), '', c.cap], ['Cash-on-cash', pcn(c.coc), cls(c.coc), c.coc],
        ['DSCR', x2(c.dscr), c.dscr < 1.2 ? 'neg' : '', isFinite(c.dscr) ? c.dscr : 99], [`IRR, ${c.N} yrs`, pcn(c.irr), cls(c.irr), isFinite(c.irr) ? c.irr : -99], ['Cash to close', $(c.cash)]],
      flags: uflags(i, c) };
  },
});

const line = (l, v, c = '') => `<tr><td>${l}</td><td class="r ${c}">${v}</td></tr>`;

function render() {
  const c = ucalc(U), y = c.y1, N = c.N, mo = (v) => $(v / 12);
  const s = [];

  s.push(sec('sum', 'Investment summary', `
    <div class="kpis">
      ${kpi('Cash flow / month', $(c.mo.cf), 'After loan and reserves, before tax', cls(c.mo.cf))}
      ${kpi('Cap rate', pcn(c.cap), 'NOI divided by price')}
      ${kpi('Cash-on-cash', pcn(c.coc), 'Year 1 cash flow on cash in', cls(c.coc))}
      ${kpi('DSCR', x2(c.dscr) + 'x', 'NOI divided by loan payments', c.dscr < 1.2 ? 'neg' : '')}
      ${kpi(`IRR over ${N} years`, pcn(c.irr), 'After tax, including the sale', cls(c.irr))}
      ${kpi('Cash to close', $(c.cash), 'Down payment, costs, repairs')}
    </div>
    ${learn(`<p><code>NOI = rent collected - running costs</code>. It leaves out the loan, so it measures the property on its own.</p>
      <p><code>Cap rate = NOI / price</code>. <code>Cash-on-cash = year 1 cash flow / cash you put in</code>. <code>DSCR = NOI / loan payments</code>.</p>
      <p><code>IRR</code> is your yearly return on the cash you put in, counting each year's after-tax cash flow and what you keep when you sell.</p>`)}`));

  s.push(sec('check', 'Deal check', flagList(uflags(U, c))));
  s.push(sec('deals', 'Saved deals', deals.body()));

  s.push(sec('cash', 'Monthly cash flow, year 1', `
    <div class="tbl"><table>
      ${line('Rent', $(y.rent / 12))}${line('Vacancy', $(-y.vac / 12))}
      ${line('Property tax', $(-y.ptax / 12))}${line('Insurance', $(-y.ins / 12))}${line('HOA', $(-y.hoa / 12))}${line('Utilities', $(-y.util / 12))}
      ${line('Maintenance', $(-y.maint / 12))}${line('Property management', $(-y.mgmt / 12))}
      <tr class="tot"><td>Net operating income</td><td class="r ${cls(y.noi)}">${mo(y.noi)}</td></tr>
      ${line('Loan payment (principal and interest)', $(-c.pay))}${line('Capital reserve', $(-y.capex / 12))}
      <tr class="tot"><td>Cash flow before tax</td><td class="r ${cls(c.mo.cf)}">${$(c.mo.cf)}</td></tr>
      ${line('Tax (negative means a saving)', $(-y.tax / 12))}
      <tr class="tot"><td>Cash flow after tax</td><td class="r ${cls(c.mo.cfAfter)}">${$(c.mo.cfAfter)}</td></tr></table></div>
    ${learn(`<p>Read it top to bottom: rent, less empty months, less the costs of owning it, gives NOI. Then the loan payment and a reserve for big repairs come off to give what is left in your pocket.</p>
      <p>The reserve is not a bill you pay every month, but roofs, furnaces and water heaters do wear out, so leaving it out makes a deal look better than it is. Property tax here is a percentage of price; it can be reassessed after you buy, so check the county.</p>`)}`));

  s.push(sec('buy', 'Loan and rules of thumb', `
    <div class="two">
      <div class="col"><h4>Loan</h4>${row('Loan amount', $(c.loan))}${row('Payment (principal and interest)', $(c.pay) + ' /mo')}${row('Interest in year 1', $(y.int))}${row(`Balance after ${N} years`, $(c.last.bal))}</div>
      <div class="col"><h4>Rules of thumb</h4>${row('Rent as % of price (1% rule)', pcn(c.onePct))}${row('Gross rent multiplier', x2(c.grm) + 'x')}${row('Running costs share of rent', pcn(c.opexRatio, 1))}${row('Break-even occupancy', pcn(c.breakEven, 0))}</div>
    </div>
    ${learn(`<p>The <code>1% rule</code> says monthly rent should be at least 1% of the price. <code>Gross rent multiplier = price / yearly rent</code>, lower is cheaper per dollar of rent. <code>Break-even occupancy</code> is the share of the year the home must be rented to cover costs, the loan and the reserve.</p>
      <p>A 30-year fixed loan keeps the same payment for life, so rent growth steadily improves cash flow. Early on, most of each payment is interest; the table below shows the balance falling slowly.</p>`)}`));

  s.push(sec('tax', 'Tax: depreciation and passive losses', `
    <div class="two">
      <div class="col"><h4>Year 1</h4>${row('NOI', $(y.noi))}${row('Less loan interest', $(-y.int))}${row('Less depreciation', $(-c.dep))}${row('<b>Taxable rental income</b>', $(y.taxable), cls(y.taxable))}${row('Tax effect (negative is a saving)', $(y.tax))}</div>
      <div class="col"><h4>Your position</h4>${row('Federal bracket on top of other income', pc(c.marginal * 100, 0))}${row('Rental loss you can use', $(c.passive))}${row('Yearly depreciation', $(c.dep))}${row(`Unused losses carried at year ${N}`, $(c.last.susp))}</div>
    </div>
    ${learn(`<p>Residential rentals are depreciated over 27.5 years (straight line): <code>(price + closing costs + repairs - land) / 27.5</code> a year. It is a deduction on paper only, so taxable income can be negative while cash flow is positive. This calculator takes a full year of depreciation in year 1; the real first year is prorated by the month placed in service.</p>
      <p>Rental losses are "passive". A rule lets landlords who actively manage deduct up to $25,000 against other income, cut by 50 cents for each dollar of income over $100,000, to zero at $150,000. Losses you cannot use are carried forward and used against later rental profit or released when you sell. This shortcut treats your income entered as your adjusted gross income and ignores other limits such as the 20% pass-through deduction.</p>`)}`));

  s.push(sec('proj', `${N} year projection`, `
    <div class="tbl"><table><tr><th>Year</th><th class="r">NOI</th><th class="r">Cash flow</th><th class="r">After tax</th><th class="r">Loan balance</th></tr>
      ${c.rows.map((r) => `<tr><td>${r.t}</td><td class="r">${$(r.noi)}</td><td class="r ${cls(r.cf)}">${$(r.cf)}</td><td class="r ${cls(r.cfAfter)}">${$(r.cfAfter)}</td><td class="r">${$(r.bal)}</td></tr>`).join('')}</table></div>
    ${learn(`<p>Rent grows ${U.rentGrowth}% and costs ${U.expGrowth}% a year while the loan payment stays fixed, so a tight deal improves over time. Growth assumptions are guesses, so test the stress table below.</p>`)}`));

  s.push(sec('sale', `Sale after ${N} years`, `
    <div class="kpis">
      ${kpi('Sale price', $(c.value), `${U.appreciation}% a year growth`)}
      ${kpi('Cash after tax', $(c.net), 'After loan, costs and taxes', cls(c.net))}
      ${kpi('Total profit', $(c.totalProfit), 'All cash back minus cash in', cls(c.totalProfit))}
      ${kpi('IRR', pcn(c.irr), 'After tax', cls(c.irr))}
      ${kpi('Equity multiple', x2(c.multiple) + 'x', 'Cash back / cash in')}
    </div>
    <div class="two">
      <div class="col"><h4>Sale</h4>${row('Sale price', $(c.value))}${row(`Selling costs (${U.sellCost}%)`, $(-c.sellCost))}${row('Repay loan', $(-c.last.bal))}${row('Taxes on the sale', $(-c.saleTax))}${row('<b>Cash you keep</b>', $(c.net))}</div>
      <div class="col"><h4>Taxes on the sale</h4>${row('Gain on sale', $(c.gain))}${row('Of which depreciation recapture', $(c.recap))}${row('Recapture tax (25% cap on building)', $(c.recapTax))}${row('Capital gains tax (0/15/20%)', $(c.ltTax))}${row('Investment income tax (3.8%)', $(c.niitSale))}${row('State income tax', $(c.stateSale))}${c.suspSaving ? row('Released passive losses', $(-c.suspSaving)) : ''}</div>
    </div>
    ${learn(`<p>Gain = sale price - selling costs - (what you paid and spent - depreciation you claimed). The part of the gain equal to depreciation claimed ("recapture") is taxed at your ordinary rate up to a 25% cap. The rest is taxed at 0, 15 or 20% depending on income, stacked on top of your other income. A 3.8% investment income tax applies above $200,000 (single) or $250,000 (joint). Federal figures are for ${US_TAX.asOf}.</p>
      <p>This ignores a 1031 exchange (which can defer these taxes), the home sale exclusion, state capital gains quirks, and tax on the equity you may take out by refinancing. Selling costs and recapture surprise many first-time landlords, so check the cash you keep.</p>`)}`));

  const cs = U.costSeg, ex = U.exchange;
  if (cs || ex) {
    const rowsA = [];
    let body = '';
    if (cs) {
      const p = ucalc({ ...U, costSeg: false });
      const side = (z, t) => `<div class="col"><h4>${t}</h4>${row('Year 1 depreciation', $(z.dep))}${row('Year 1 taxable income', $(z.y1.taxable))}${row('Year 1 tax effect', $(z.y1.tax))}${row('Suspended losses', $(z.last.susp))}${row('Recapture tax at sale', $(z.recapTax))}${row('Cash kept at sale', $(z.net))}${row('IRR after tax', pcn(z.irr), cls(z.irr))}</div>`;
      body += `<h4>Cost segregation</h4><div class="two">${side(p, 'Without')}${side(c, 'With')}</div>`;
    }
    if (ex) {
      body += `<h4>1031 exchange</h4><div class="two"><div class="col">${row('Gain on sale', $(c.gain))}${row('Gain deferred', $(c.deferredGain))}${row('Gain taxed now (boot)', $(c.recognized))}</div>
        <div class="col">${row('Sale taxes now', $(c.saleTax))}${row('<b>Tax deferred, still owed later</b>', $(c.deferred))}</div></div>`;
    }
    s.push(sec('adv', 'Cost segregation and 1031 effects', body + learn(`<p>This compares the same deal with the switch off. Cost segregation moves deductions earlier, but rental losses above your allowance are suspended, and the extra depreciation comes back as ordinary-rate tax when you sell. A 1031 exchange defers sale taxes: the IRR shown assumes you keep the equity without paying them, so treat it as flattering. See Tax topics to learn.</p>`)));
  }
  const rowsS = USTRESS.map(([name, o]) => ({ name, s: ucalc(U, o) }));
  s.push(sec('stress', 'Stress tests', `
    <div class="tbl"><table><tr><th>Scenario</th><th class="r">DSCR</th><th class="r">Cash flow /mo</th><th class="r">IRR</th></tr>
      ${rowsS.map(({ name, s: z }) => `<tr><td>${name}</td><td class="r ${z.dscr < 1.2 ? 'neg' : ''}">${x2(z.dscr)}</td><td class="r ${cls(z.mo.cf)}">${$(z.mo.cf)}</td><td class="r ${cls(z.irr)}">${pcn(z.irr)}</td></tr>`).join('')}</table></div>
    ${learn(`<p>Each line changes one thing and reruns the deal. The rate lines show what the deal looks like at a higher loan rate, which matters if you buy later or refinance. Look for the scenario that sends cash flow deeply negative, then ask whether you could carry it.</p>`)}`));

  s.push(usTopics());

  document.getElementById('results').innerHTML = s.join('');
  document.getElementById('pinbar').innerHTML =
    `<div><span>Cash flow / mo</span><b class="${cls(c.mo.cf)}">${$(c.mo.cf)}</b></div><div><span>Cash-on-cash</span><b class="${cls(c.coc)}">${pcn(c.coc, 1)}</b></div><div><span>IRR</span><b class="${cls(c.irr)}">${pcn(c.irr, 1)}</b></div>`;
}

render();
trackSections(document.getElementById('results'));
