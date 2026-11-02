// US commercial and multifamily engine. Needs calc-us.js (tax helpers). No DOM.
// Depreciation lives: 27.5 years residential rental, 39 years nonresidential (26 U.S.C. 168(c), IRS Pub 946).
const UC_X = { m: 12, y: 1 };
const ucRent = (i) => i.roll.reduce((a, r) => a + r.count * r.rent * UC_X[i.rentBasis], 0);
const ucUnits = (i) => i.roll.reduce((a, r) => a + r.count, 0);
const ucLife = (i) => (i.ptype === 'multi' ? 27.5 : 39);

// Interest-only for ioYears, then principal and interest over `amort` years.
function ucSchedule(i, rate, years) {
  const loan = i.price * i.ltv / 100, m = rate / 1200, ioM = i.ioYears * 12;
  const pay = usPmt(loan, rate, i.amort), rows = [];
  let bal = loan;
  for (let y = 1; y <= years; y++) {
    let int = 0, prin = 0;
    for (let k = 0; k < 12; k++) {
      const it = bal * m;
      int += it;
      if ((y - 1) * 12 + k >= ioM && bal > 0) { const pr = Math.min(pay - it, bal); prin += pr; bal -= pr; }
    }
    rows.push({ y, int, prin, ds: int + prin, bal });
  }
  return { rows, pay };
}

function ucNoi(i, t, o = {}) {
  const gr = (1 + i.rentGrowth / 100) ** (t - 1), ge = (1 + i.expGrowth / 100) ** (t - 1), x = o.expMult ?? 1;
  const rent = ucRent(i) * (o.rentMult ?? 1) * gr, other = i.extraIncome * gr;
  const gpi = rent + other, vac = gpi * (i.vacancy + (o.vacAdd || 0)) / 100, cred = gpi * i.creditLoss / 100, egi = gpi - vac - cred;
  const ptax = i.price * i.propTax / 100 * ge * x, ins = i.insurance * ge * x, rep = i.repairs * ge * x;
  const rec = (ptax + ins + rep) * i.recovery / 100, otherOp = i.otherOpex * ge * x, mgmt = egi * i.mgmt / 100;
  const opex = ptax + ins + rep + otherOp + mgmt, noi = egi + rec - opex, capex = egi * i.capex / 100;
  return { rent, other, gpi, vac, cred, egi, rec, ptax, ins, rep, otherOp, mgmt, opex, noi, capex };
}

// o: stress overrides { rateAdd, vacAdd, rentMult, expMult, exitCapAdd }
function uccalc(i, o = {}) {
  const rate = i.rate + (o.rateAdd || 0), exitCap = Math.max(0.5, i.exitCap + (o.exitCapAdd || 0));
  const N = Math.min(30, Math.max(1, Math.round(i.hold)));
  const loan = i.price * i.ltv / 100, closing = i.price * i.closing / 100, cash = i.price - loan + closing;
  const basis = i.price + closing, life = ucLife(i), dep = basis * (1 - i.landPct / 100) / life;
  const { rows: sched, pay } = ucSchedule(i, rate, N);
  const passive = Math.max(0, US_TAX.passive.allowance - 0.5 * Math.max(0, i.otherIncome - US_TAX.passive.phaseStart));
  const base = baseIncome(i), niitThr = US_TAX.niit[i.fs], sr = i.stateTax / 100;
  const rows = [];
  let susp = 0;
  for (let t = 1; t <= N; t++) {
    const n = ucNoi(i, t, o), s = sched[t - 1], cf = n.noi - n.capex - s.ds;
    const taxable = n.noi - s.int - dep;
    let net;
    if (taxable < 0) { const use = Math.min(-taxable, passive); susp += -taxable - use; net = -use; }
    else { const use = Math.min(susp, taxable); susp -= use; net = taxable - use; }
    const fed = fedTax(Math.max(0, base + net), i.fs) - fedTax(base, i.fs);
    const niit = net > 0 ? 0.038 * Math.min(net, Math.max(0, i.otherIncome + net - niitThr)) : 0;
    const tax = fed + niit + net * sr;
    rows.push({ t, ...n, int: s.int, prin: s.prin, ds: s.ds, bal: s.bal, cf, dep, taxable, net, susp, tax, cfAfter: cf - tax });
  }
  const y1 = rows[0], last = rows[N - 1];
  const fwd = ucNoi(i, N + 1, o).noi, value = fwd / (exitCap / 100), sellCost = value * i.sellCost / 100;
  const gain = Math.max(0, value - sellCost - (basis - dep * N)), recap = Math.min(gain, dep * N), capGain = gain - recap;
  const recapTax = Math.min(recap * US_TAX.recapMax, fedTax(base + recap, i.fs) - fedTax(base, i.fs));
  const ltTax = ltcgTax(base + recap, capGain, i.fs);
  const niitSale = 0.038 * Math.min(gain, Math.max(0, i.otherIncome + gain - niitThr)), stateSale = gain * sr;
  const suspSaving = fedTax(base, i.fs) - fedTax(Math.max(0, base - last.susp), i.fs) + last.susp * sr;
  const saleTax = recapTax + ltTax + niitSale + stateSale - suspSaving;
  const net = value - sellCost - last.bal - saleTax;
  const flows = [-cash, ...rows.map((r) => r.cfAfter)];
  flows[N] += net;
  const piYear = pay * 12, units = ucUnits(i);
  return {
    loan, closing, cash, basis, life, dep, rows, N, y1, last, passive, base, fwd, exitCap, value, sellCost, gain, recap, capGain,
    recapTax, ltTax, niitSale, stateSale, suspSaving, saleTax, net, piYear, ioYear: y1.ds,
    totalProfit: flows.reduce((a, b) => a + b, 0), multiple: flows.slice(1).reduce((a, b) => a + b, 0) / cash, irr: irr(flows),
    cap: y1.noi / i.price * 100, coc: y1.cf / cash * 100,
    dscr: y1.ds > 0 ? y1.noi / y1.ds : Infinity, dscrPI: piYear > 0 ? y1.noi / piYear : Infinity,
    icr: y1.int > 0 ? y1.noi / y1.int : Infinity, debtYield: loan > 0 ? y1.noi / loan * 100 : Infinity,
    breakEven: (y1.opex - y1.rec + y1.ds + y1.capex) / y1.gpi * 100,
    grm: i.price / y1.gpi, perUnit: units ? i.price / units : 0, perSf: i.area > 0 ? i.price / i.area : 0, units,
    opexRatio: y1.opex / y1.egi * 100, marginal: marginal(i),
  };
}

const UCSTRESS = [
  ['Base case', {}], ['Rate +1%', { rateAdd: 1 }], ['Rate +2%', { rateAdd: 2 }], ['Vacancy +5 points', { vacAdd: 5 }],
  ['Rents down 10%', { rentMult: 0.9 }], ['Expenses up 10%', { expMult: 1.1 }], ['Exit cap +0.5%', { exitCapAdd: 0.5 }], ['Exit cap +1%', { exitCapAdd: 1 }],
  ['Rate +2%, vacancy +5, exit cap +1%', { rateAdd: 2, vacAdd: 5, exitCapAdd: 1 }],
];

function ucflags(i, c) {
  const out = [], m = (n) => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
  const add = (lvl, head, why) => out.push({ lvl, head, why });
  const x = (n) => (isFinite(n) ? n.toFixed(2) + 'x' : 'n/a');
  if (c.loan > 0) {
    if (c.dscr < 1.2) add('bad', `DSCR of ${x(c.dscr)} is thin`, 'DSCR is NOI divided by loan payments. Commercial lenders commonly want 1.20 to 1.35x or more, so this loan may be cut back or declined.');
    else if (c.dscr < 1.35) add('warn', `DSCR of ${x(c.dscr)} is near typical lender minimums`, 'Many lenders ask for about 1.25x. You have little room for vacancy or a rate rise before income stops covering payments.');
    else add('ok', `DSCR of ${x(c.dscr)} is comfortable`, 'Income covers loan payments with room to spare, which is what lenders look for.');
    if (i.ioYears > 0 && c.dscrPI < c.dscr - 0.01)
      add(c.dscrPI < 1.2 ? 'bad' : 'warn', `Payments step up when interest-only ends: DSCR falls to ${x(c.dscrPI)}`, `Payments rise from ${m(c.ioYear)} to ${m(c.piYear)} a year once principal starts. Test the deal on the higher figure.`);
    if (c.cap < i.rate) add('warn', `Negative leverage: cap rate ${c.cap.toFixed(2)}% is below the ${i.rate}% loan rate`, 'The debt costs more than the property earns, so more borrowing lowers your cash return unless income and value grow enough.');
    if (c.debtYield < 8) add('warn', `Debt yield of ${c.debtYield.toFixed(1)}% is low`, 'Debt yield is NOI divided by the loan. Lenders often look for 8 to 10% or more, a check that ignores the interest rate.');
    if (i.hold < i.amort) add('info', `Balloon risk: ${m(c.last.bal)} is still owed at year ${c.N}`, 'Commercial loans often come due in 5 to 10 years while payments are set as if they run 25 to 30. You must refinance or sell then, at whatever rates and values exist.');
  }
  if (c.breakEven > 85) add('warn', `Break-even occupancy is ${c.breakEven.toFixed(0)}%`, 'Share of potential rent needed to cover costs, loan payments and reserves. Above about 85% leaves little margin.');
  if (c.coc < 0) add('bad', `Cash flow is negative before tax (${m(c.y1.cf)} a year)`, 'After costs, reserves and loan payments the property costs you money each year.');
  if (i.vacancy < 5) add('warn', `Vacancy allowance of ${i.vacancy}% is thin`, 'Even well-let buildings lose income between tenants. Lenders and buyers usually underwrite 5% or more, and more for office and retail.');
  if (i.mgmt <= 0) add('warn', 'No management fee included', 'Lenders and buyers assume a fee even if you manage it yourself.');
  if (i.capex <= 0) add('warn', 'No capital reserve included', 'Roofs, HVAC and tenant improvements wear out. 2 to 5% of income is a common allowance.');
  if (i.exitCap < c.cap - 0.01) add('warn', `Exit cap rate ${i.exitCap}% is below today's ${c.cap.toFixed(2)}%`, 'This assumes buyers accept a lower yield when you sell, which lifts the sale price. A cautious case sells at the same cap rate or higher.');
  if (c.opexRatio > 55) add('warn', `Running costs take ${c.opexRatio.toFixed(0)}% of income`, 'Costs are high relative to income. Compare each line with the seller\'s operating statements.');
  else if (c.opexRatio < 25 && i.recovery < 50) add('warn', `Running costs are only ${c.opexRatio.toFixed(0)}% of income`, 'That is lean when the owner pays the bills. Check nothing has been left out.');
  if (c.passive < US_TAX.passive.allowance && c.y1.taxable < 0)
    add('warn', 'Rental losses are partly blocked by the passive loss rules', `Your income of ${m(i.otherIncome)} cuts the $25,000 rental loss allowance to ${m(c.passive)}. Unused losses carry forward until you have rental profit or sell.`);
  if (i.ptype !== 'multi') add('info', 'Check the leases, not just the numbers', 'Ask for lease expiry dates, rent steps, who pays taxes, insurance and repairs (NNN or gross), tenant credit and what happens when a big tenant leaves. Depreciation uses 39 years for commercial buildings.');
  else add('info', 'Check the rent roll, condition and local rules', 'For apartments, compare rents with the market, check each unit\'s actual lease and condition, and ask about rent regulation and local code requirements. Depreciation uses 27.5 years.');
  add('info', `Cash needed to close: ${m(c.cash)}`, `Down payment plus ${m(c.closing)} of closing costs at the rate you entered. Lender fees, due diligence and reserves are often extra.`);
  return out;
}

if (typeof module !== 'undefined') module.exports = { uccalc, ucflags, UCSTRESS, ucRent, ucNoi };
