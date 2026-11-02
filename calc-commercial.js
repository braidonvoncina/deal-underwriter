// Commercial and multifamily engine (Australia). Needs calc.js for stampDuty, landTax, pmt, depreciation.
const RENT_X = { w: 52, m: 12, y: 1 };
const annualRent = (i) => i.roll.reduce((a, r) => a + r.count * r.rent * RENT_X[i.rentBasis], 0);
const unitCount = (i) => i.roll.reduce((a, r) => a + r.count, 0);
const cgtDiscount = (tax) => (tax === 15 ? 1 / 3 : tax === 25 || tax === 30 ? 0 : 0.5);

// Interest-only for the first ioYears, then principal and interest over the rest of the term.
function loanSchedule(i, rate, years) {
  const loan = i.price * i.lvr / 100, m = rate / 1200, ioM = Math.min(i.ioYears, i.term) * 12, piN = i.term * 12 - ioM;
  const pay = piN > 0 ? pmt(loan, rate, piN / 12) : 0, rows = [];
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
  return rows;
}

// One year of operations. t = 1 is the first year; growth starts in year 2.
function noiYear(i, t, o = {}) {
  const gr = (1 + i.rentGrowth / 100) ** (t - 1), ge = (1 + i.expGrowth / 100) ** (t - 1);
  const rent = annualRent(i) * (o.rentMult ?? 1) * gr, other = i.otherIncome * gr;
  const gpi = rent + other, vac = gpi * (i.vacancy + (o.vacAdd || 0)) / 100, cred = gpi * i.creditLoss / 100, egi = gpi - vac - cred;
  const lt = landTax(i.landValue, i.state, true) * ge, x = (o.expMult ?? 1);
  const pool = (i.rates + i.insurance + i.repairs) * ge * x + lt * x;
  const rec = pool * i.recovery / 100, otherOp = i.otherOpex * ge * x, mgmt = egi * i.mgmtPct / 100;
  const opex = pool + otherOp + mgmt, noi = egi + rec - opex, capex = egi * i.capexPct / 100;
  return { rent, other, gpi, vac, cred, egi, rec, rates: i.rates * ge * x, insurance: i.insurance * ge * x, repairs: i.repairs * ge * x, lt: lt * x, otherOp, mgmt, opex, noi, capex };
}

function irr(cfs) {
  const f = (r) => cfs.reduce((a, c, k) => a + c / (1 + r) ** k, 0);
  let lo = -0.9, hi = 5;
  if (f(lo) * f(hi) > 0) return NaN;
  for (let n = 0; n < 80; n++) { const mid = (lo + hi) / 2; f(lo) * f(mid) <= 0 ? (hi = mid) : (lo = mid); }
  return (lo + hi) / 2 * 100;
}

// o: optional stress overrides { rateAdd, exitCapAdd, vacAdd, rentMult, expMult }
function ccalc(i, o = {}) {
  const rate = i.rate + (o.rateAdd || 0), exitCap = Math.max(0.5, i.exitCap + (o.exitCapAdd || 0));
  const loan = i.price * i.lvr / 100, duty = stampDuty(i.price, i.state), equity = i.price - loan + duty + i.acq;
  const N = Math.min(10, Math.max(1, Math.round(i.hold))), sched = loanSchedule(i, rate, N);
  const dp = depreciation({ tax: i.tax, construction: i.construction, pne: i.pne, method: 'dv' });
  const rows = [];
  for (let t = 1; t <= N; t++) {
    const n = noiYear(i, t, o), s = sched[t - 1], dep = dp.rows[t - 1].total;
    const taxable = n.noi - s.int - dep, tax = taxable * i.tax / 100, cf = n.noi - n.capex - s.ds;
    rows.push({ t, ...n, int: s.int, prin: s.prin, ds: s.ds, bal: s.bal, dep, taxable, tax, cf, cfAfter: cf - tax });
  }
  const y1 = rows[0], fwd = noiYear(i, N + 1, o).noi, sale = fwd / (exitCap / 100), costs = sale * i.sellCost / 100, bal = rows[N - 1].bal;
  const cwTotal = dp.rows.slice(0, N).reduce((a, r) => a + r.cw, 0);
  const gain = Math.max(0, sale - costs - (i.price + duty + i.acq - cwTotal)), disc = cgtDiscount(i.tax);
  const cgt = gain * (1 - disc) * i.tax / 100, net = sale - costs - bal - cgt;
  const flows = [-equity, ...rows.map((r) => r.cfAfter)];
  flows[N] += net;
  const back = flows.slice(1).reduce((a, b) => a + b, 0);
  const piYear = i.ioYears < i.term ? pmt(loan, rate, i.term - i.ioYears) * 12 : y1.ds;
  const units = unitCount(i);
  return {
    loan, duty, equity, rows, N, y1, dp, sale, costs, bal, gain, cgt, disc, net, fwd, exitCap,
    cap: y1.noi / i.price * 100,
    dscr: y1.ds > 0 ? y1.noi / y1.ds : Infinity,
    dscrPI: piYear > 0 ? y1.noi / piYear : Infinity,
    icr: y1.int > 0 ? y1.noi / y1.int : Infinity,
    debtYield: loan > 0 ? y1.noi / loan * 100 : Infinity,
    breakEven: (y1.opex - y1.rec + y1.ds) / y1.gpi * 100,
    coc: y1.cf / equity * 100, cocAfter: y1.cfAfter / equity * 100,
    irr: irr(flows), multiple: back / equity, piYear, ioYear: y1.ds,
    grm: i.price / y1.gpi, perUnit: units ? i.price / units : 0, perSqm: i.area > 0 ? i.price / i.area : 0, units,
    opexRatio: y1.opex / y1.egi * 100, lvr: i.lvr,
  };
}

const STRESS = [
  ['Base case', {}], ['Interest rate +1%', { rateAdd: 1 }], ['Interest rate +2%', { rateAdd: 2 }],
  ['Vacancy +5 points', { vacAdd: 5 }], ['Rents down 10%', { rentMult: 0.9 }], ['Expenses up 10%', { expMult: 1.1 }],
  ['Exit cap +0.5%', { exitCapAdd: 0.5 }], ['Exit cap +1%', { exitCapAdd: 1 }],
  ['Rate +2%, vacancy +5, exit cap +1%', { rateAdd: 2, vacAdd: 5, exitCapAdd: 1 }],
];

function cflags(i, c) {
  const out = [], m = (n) => '$' + Math.round(Math.abs(n)).toLocaleString('en-AU');
  const add = (lvl, head, why) => out.push({ lvl, head, why });
  const x = (n) => (isFinite(n) ? n.toFixed(2) + 'x' : 'n/a');
  if (c.loan > 0) {
    if (c.dscr < 1.2) add('bad', `DSCR of ${x(c.dscr)} is thin`, 'DSCR is NOI divided by loan repayments. Most lenders want 1.25x to 1.5x or more, so this loan may not get approved or may need a lower LVR.');
    else if (c.dscr < 1.5) add('warn', `DSCR of ${x(c.dscr)} is borderline`, 'Many lenders ask for 1.5x. There is not much room for a vacancy or rate rise before income stops covering repayments.');
    else add('ok', `DSCR of ${x(c.dscr)} is comfortable`, 'Income covers the repayments with room to spare, which is what lenders look for.');
    if (i.ioYears > 0 && i.ioYears < i.term && c.dscrPI < c.dscr - 0.01)
      add(c.dscrPI < 1.2 ? 'bad' : 'warn', `Repayments step up when interest-only ends: DSCR drops to ${x(c.dscrPI)}`, `Repayments rise from ${m(c.ioYear)} to ${m(c.piYear)} a year once principal is repaid. Test the deal on the higher figure, because that is where it has to survive.`);
    if (c.cap < i.rate) add('warn', `Negative leverage: yield ${c.cap.toFixed(2)}% is below the ${i.rate}% loan rate`, 'The debt costs more than the property earns, so borrowing more lowers your return on cash unless rents and values grow enough to make up for it.');
    if (c.debtYield < 8) add('warn', `Debt yield of ${c.debtYield.toFixed(1)}% is low`, 'Debt yield is NOI divided by the loan. Lenders often want 8 to 10% or more, as a check that does not depend on the interest rate.');
  }
  if (c.breakEven > 85) add('warn', `Break-even occupancy is ${c.breakEven.toFixed(0)}%`, 'That is the share of the building that must be rented just to cover costs and repayments. Above about 85% leaves little margin for vacancy.');
  if (c.coc < 0) add('bad', `Cash flow is negative before tax (${m(c.y1.cf)} a year)`, 'After costs, a capital reserve and repayments the property costs you money each year. You would be funding it while you wait for growth.');
  if (i.vacancy < 3) add('warn', `Vacancy allowance of ${i.vacancy}% is thin`, 'Even well-let buildings lose some income between tenants. Most underwriting uses 5% or more for residential and more for commercial.');
  if (i.mgmtPct <= 0) add('warn', 'No management fee included', 'Even if you manage it yourself, lenders and buyers will assume a fee, and your time has a cost.');
  if (i.capexPct <= 0) add('warn', 'No capital reserve included', 'Roofs, lifts, air-conditioning and fit-outs wear out. A reserve of 2 to 5% of income is a common allowance.');
  if (i.exitCap < c.cap - 0.01) add('warn', `Exit cap rate ${i.exitCap}% is below today's ${c.cap.toFixed(2)}%`, 'This assumes the market values the building at a lower yield when you sell, which pushes the sale price up. A cautious case sells at the same cap rate or higher.');
  if (c.opexRatio > 50) add('warn', `Running costs take ${c.opexRatio.toFixed(0)}% of income`, 'Costs are high relative to income. Check each line against real bills or the seller\'s outgoings statement.');
  else if (c.opexRatio < 20 && i.recovery < 50) add('warn', `Running costs are only ${c.opexRatio.toFixed(0)}% of income`, 'That is lean for a building where the owner pays the bills. Check nothing has been left out.');
  if (i.ptype !== 'multi') add('info', 'Check the leases, not just the numbers', 'Ask for lease expiry dates, rent reviews, who pays outgoings, make-good obligations and tenant quality. A short average lease term (WALE) makes future income uncertain. Also confirm how GST applies to the sale.');
  else add('info', 'Check zoning, condition and tenant mix', 'For an apartment block, ask about strata or title structure, building condition, fire and safety compliance, and how rents compare with similar units nearby.');
  add('info', `Cash needed to settle: ${m(c.equity)}`, `Deposit, ${m(c.duty)} stamp duty and acquisition costs. Stamp duty here uses the general rates; commercial and going-concern sales can differ by state.`);
  return out;
}

if (typeof module !== 'undefined') module.exports = { ccalc, cflags, noiYear, annualRent, STRESS };
