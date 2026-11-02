// US residential investor engine. No DOM, no dependencies.
// Federal figures: IRS Rev. Proc. 2025-32 (tax year 2026), read from irs.gov. Other rates are labelled approximations.
const US_TAX = {
  asOf: 'tax year 2026, IRS Rev. Proc. 2025-32',
  brackets: {
    single: [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [Infinity, .37]],
    mfj: [[24800, .10], [100800, .12], [211400, .22], [403550, .24], [512450, .32], [768700, .35], [Infinity, .37]],
  },
  std: { single: 16100, mfj: 32200 },
  ltcg: { single: [49450, 545500], mfj: [98900, 613700] }, // top of the 0% band, top of the 15% band
  niit: { single: 200000, mfj: 250000 }, // IRS Topic 559, not inflation-indexed
  passive: { allowance: 25000, phaseStart: 100000 }, // IRC 469(i): loses 50 cents per $ of AGI over 100k
  life: 27.5, recapMax: 0.25,
};
// [name, effective property tax % of owner-occupied value, state income tax % for a middle-income filer].
// Property tax: Tax Foundation "Property Taxes by State and County, 2026" (2024 ACS data), read Nov 2026; XX is a rounded national placeholder.
// Income tax: flat rates from Tax Foundation "State Individual Income Tax Rates and Brackets, 2026". CA, NY, NJ are graduated, so those are
// mid-bracket placeholders (top rates are 13.3, 10.9, 10.75). WA taxes only capital gains (7%), not modelled. Edit the rate for your own income.
const US_STATES = {
  TX: ['Texas', 1.40, 0], FL: ['Florida', 0.78, 0], CA: ['California', 0.70, 9.3], NY: ['New York', 1.30, 6], NJ: ['New Jersey', 1.88, 6.4],
  IL: ['Illinois', 1.88, 4.95], OH: ['Ohio', 1.36, 2.75], PA: ['Pennsylvania', 1.26, 3.07], GA: ['Georgia', 0.79, 5.19], NC: ['North Carolina', 0.66, 3.99],
  AZ: ['Arizona', 0.48, 2.5], TN: ['Tennessee', 0.52, 0], CO: ['Colorado', 0.50, 4.4], WA: ['Washington', 0.75, 0], MI: ['Michigan', 1.19, 4.25],
  IN: ['Indiana', 0.76, 2.95], MO: ['Missouri', 0.89, 4.7], NV: ['Nevada', 0.50, 0], XX: ['Other state', 1.0, 5],
};

const usPmt = (P, rate, yrs) => {
  const r = rate / 1200, n = yrs * 12;
  return P <= 0 ? 0 : r ? P * r / (1 - (1 + r) ** -n) : P / n;
};
const fedTax = (ti, fs) => {
  let tax = 0, lo = 0;
  for (const [hi, r] of US_TAX.brackets[fs]) { if (ti > lo) tax += (Math.min(ti, hi) - lo) * r; lo = hi; }
  return tax;
};
const baseIncome = (i) => Math.max(0, i.otherIncome - US_TAX.std[i.fs]);
const marginal = (i) => { const b = baseIncome(i); return (US_TAX.brackets[i.fs].find(([hi]) => b < hi) || [0, .37])[1]; };
// Long-term gain stacks on top of ordinary taxable income `base`.
function ltcgTax(base, gain, fs) {
  const [z, f] = US_TAX.ltcg[fs], hi = base + gain;
  const part = (a, b) => Math.max(0, Math.min(hi, b) - Math.max(base, a));
  return part(z, f) * .15 + part(f, Infinity) * .20;
}
function irr(cfs) {
  const f = (r) => cfs.reduce((a, c, k) => a + c / (1 + r) ** k, 0);
  let lo = -0.9, hi = 5;
  if (f(lo) * f(hi) > 0) return NaN;
  for (let n = 0; n < 80; n++) { const mid = (lo + hi) / 2; f(lo) * f(mid) <= 0 ? (hi = mid) : (lo = mid); }
  return (lo + hi) / 2 * 100;
}

// Depreciation by year, split into the building (straight line over `life`) and short-life parts from a cost segregation study.
// Short-life parts: bonusPct is deducted in year 1, the rest straight line over SEG_LIFE years (a blended simplification of 5, 7 and 15 year items).
const SEG_LIFE = 10;
function usDep(i, basis, life, N) {
  const D = basis * (1 - i.landPct / 100), seg = i.costSeg ? D * i.segPct / 100 : 0;
  const bonus = seg * (i.bonusPct || 0) / 100, rem = seg - bonus, b = [], s = [];
  for (let t = 1; t <= N; t++) { b.push((D - seg) / life); s.push((t === 1 ? bonus : 0) + (t <= SEG_LIFE ? rem / SEG_LIFE : 0)); }
  return { b, s, seg, D, plain: D / life };
}
// Tax on a sale. Recapture of short-life parts is ordinary income; building recapture is capped at 25%; the rest is capital gain.
// With a 1031 exchange only boot (cash taken out) is recognised, recapture first. Suspended passive losses are not released in an exchange.
function usSaleTax(i, gain, depB, depS, base, susp) {
  const sr = i.stateTax / 100, thr = US_TAX.niit[i.fs];
  const parts = (g, off = 0) => {
    const rs = Math.min(g, depS), rb = Math.min(g - rs, depB), cg = g - rs - rb, rt = rs - off;
    const taxS = fedTax(base + rt, i.fs) - fedTax(base, i.fs);
    const taxB = Math.min(rb * US_TAX.recapMax, fedTax(base + rt + rb, i.fs) - fedTax(base + rt, i.fs));
    const lt = ltcgTax(base + rt + rb, cg, i.fs), niit = 0.038 * Math.min(g, Math.max(0, i.otherIncome + g - thr)), state = g * sr;
    return { recapS: rs, recapB: rb, capGain: cg, taxS, taxB, lt, niit, state, total: taxS + taxB + lt + niit + state };
  };
  const rec = i.exchange ? Math.min(gain, i.boot || 0) : gain, off = i.exchange ? 0 : Math.min(susp, Math.min(rec, depS)), p = parts(rec, off), full = parts(gain);
  const left = i.exchange ? 0 : susp - off;
  const suspSaving = i.exchange ? 0 : off * sr + fedTax(base, i.fs) - fedTax(Math.max(0, base - left), i.fs) + left * sr; // federal effect of `off` is already inside p.total
  return { ...p, recognized: rec, suspSaving, saleTax: p.total - suspSaving, deferred: full.total - p.total, deferredGain: gain - rec };
}

// o: optional stress overrides { rateAdd, vacAdd, rentMult, expMult, noGrowth }
function ucalc(i, o = {}) {
  const rate = i.rate + (o.rateAdd || 0), N = Math.min(30, Math.max(1, Math.round(i.hold)));
  const loan = i.price * (1 - i.down / 100), down = i.price - loan, closing = i.price * i.closing / 100;
  const cash = down + closing + i.rehab, basis = i.price + closing + i.rehab;
  const D = usDep(i, basis, US_TAX.life, N);
  const pay = usPmt(loan, rate, i.term), m = rate / 1200, x = o.expMult ?? 1, app = o.noGrowth ? 0 : i.appreciation;
  const passive = i.reps ? Infinity : Math.max(0, US_TAX.passive.allowance - 0.5 * Math.max(0, i.otherIncome - US_TAX.passive.phaseStart));
  const base = baseIncome(i), niitThr = US_TAX.niit[i.fs], sr = i.stateTax / 100;
  const rows = [];
  let bal = loan, susp = 0;
  for (let t = 1; t <= N; t++) {
    const gr = (1 + i.rentGrowth / 100) ** (t - 1), ge = (1 + i.expGrowth / 100) ** (t - 1);
    const rent = i.rent * 12 * (o.rentMult ?? 1) * gr, vac = rent * (i.vacancy + (o.vacAdd || 0)) / 100, egi = rent - vac;
    const ptax = i.price * i.propTax / 100 * ge * x, ins = i.insurance * ge * x, hoa = i.hoa * 12 * ge * x, util = i.utilities * 12 * ge * x;
    const maint = rent * i.maint / 100 * x, mgmt = egi * i.mgmt / 100;
    const opex = ptax + ins + hoa + util + maint + mgmt, noi = egi - opex, capex = rent * i.capex / 100;
    let int = 0, prin = 0;
    for (let k = 0; k < 12; k++) {
      if (bal <= 0) break;
      const it = bal * m, pr = Math.min(pay - it, bal);
      int += it; prin += pr; bal -= pr;
    }
    const ds = int + prin, cf = noi - ds - capex;
    // Rental income for tax: NOI less interest less depreciation. Losses are limited by the passive loss rules.
    const dep = D.b[t - 1] + D.s[t - 1], taxable = noi - int - dep;
    let net;
    if (taxable < 0) { const use = Math.min(-taxable, i.reps ? base : passive); susp += -taxable - use; net = -use; }
    else { const use = Math.min(susp, taxable); susp -= use; net = taxable - use; }
    if (i.reps && susp > 0) { const extra = Math.min(susp, Math.max(0, base + net)); net -= extra; susp -= extra; } // carried loss used against other income
    const fed = fedTax(Math.max(0, base + net), i.fs) - fedTax(base, i.fs);
    const niit = net > 0 ? 0.038 * Math.min(net, Math.max(0, i.otherIncome + net - niitThr)) : 0;
    const tax = fed + niit + net * sr;
    rows.push({ t, rent, vac, egi, ptax, ins, hoa, util, maint, mgmt, opex, noi, capex, int, prin, ds, bal, cf, dep, taxable, net, susp, tax, cfAfter: cf - tax });
  }
  const y1 = rows[0], last = rows[N - 1];
  const value = i.price * (1 + app / 100) ** N, sellCost = value * i.sellCost / 100;
  const depB = D.b.reduce((x, y) => x + y, 0), depS = D.s.reduce((x, y) => x + y, 0), dep = rows[0].dep;
  const adjBasis = basis - depB - depS, gain = Math.max(0, value - sellCost - adjBasis);
  const T = usSaleTax(i, gain, depB, depS, base, last.susp);
  const { recognized, deferred, deferredGain, suspSaving, saleTax, niit: niitSale, state: stateSale, lt: ltTax } = T;
  const recap = T.recapS + T.recapB, recapTax = T.taxS + T.taxB, capGain = T.capGain;
  const net = value - sellCost - last.bal - saleTax;
  const flows = [-cash, ...rows.map((r) => r.cfAfter)];
  flows[N] += net;
  const totalProfit = flows.reduce((a, b) => a + b, 0);
  const gpi = i.rent * 12 * (o.rentMult ?? 1);
  return {
    loan, down, closing, cash, basis, dep, depPlain: D.plain, seg: D.seg, pay, rows, N, y1, last, passive, base, T, recognized, deferred, deferredGain,
    value, sellCost, adjBasis, gain, recap, capGain, recapTax, ltTax, niitSale, stateSale, suspSaving, saleTax, net, totalProfit,
    cap: y1.noi / i.price * 100,
    coc: y1.cf / cash * 100, cocAfter: y1.cfAfter / cash * 100,
    dscr: y1.ds > 0 ? y1.noi / y1.ds : Infinity,
    irr: irr(flows), multiple: (flows.slice(1).reduce((a, b) => a + b, 0)) / cash,
    onePct: i.rent / i.price * 100, grm: i.price / (i.rent * 12), opexRatio: y1.opex / y1.egi * 100,
    breakEven: (y1.opex + y1.ds + y1.capex) / gpi * 100, marginal: marginal(i),
    mo: { rent: i.rent, ds: pay, cf: y1.cf / 12, cfAfter: y1.cfAfter / 12 },
  };
}

const USTRESS = [
  ['Base case', {}], ['Rate +1%', { rateAdd: 1 }], ['Rate +2%', { rateAdd: 2 }], ['Vacancy +5 points', { vacAdd: 5 }],
  ['Rent down 10%', { rentMult: 0.9 }], ['Expenses up 10%', { expMult: 1.1 }], ['No price growth or rent growth', { noGrowth: true }],
  ['Rent -10%, vacancy +5, expenses +10%', { rentMult: 0.9, vacAdd: 5, expMult: 1.1 }],
];
// Rate stress changes the rate the loan would be at, so for a fixed loan it applies to a new purchase or a refinance.

function uflags(i, c) {
  const out = [], m = (n) => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
  const add = (lvl, head, why) => out.push({ lvl, head, why });
  const mo = c.y1.cf / 12;
  if (c.onePct >= 1) add('ok', `Passes the 1% rule (rent is ${c.onePct.toFixed(2)}% of price)`, 'The 1% rule says monthly rent should be at least 1% of the price. It is a quick screen, not proof, but it usually means the deal has room for costs and a loan.');
  else if (c.onePct >= 0.7) add('warn', `Misses the 1% rule (rent is ${c.onePct.toFixed(2)}% of price)`, 'Rent below 1% of price is common in expensive markets today, but it means cash flow is thin and you are relying more on price growth. Check the numbers below carefully.');
  else add('bad', `Rent is only ${c.onePct.toFixed(2)}% of price`, 'This is well under the 1% rule. At typical loan rates, cash flow is very likely negative and the deal depends on price growth.');
  if (mo < 0) add('bad', `Negative cash flow: ${m(mo)} a month after reserves`, 'You would pay this out of pocket every month. That can be worth it for growth, but you need the cash to carry it, and rents may need to rise before it turns positive.');
  else if (c.coc < 5) add('warn', `Cash-on-cash of ${c.coc.toFixed(1)}% is low`, 'Cash-on-cash is yearly cash flow divided by the cash you put in. Many investors look for 6 to 8% or more, because a savings account or index fund is the alternative.');
  else add('ok', `Cash-on-cash of ${c.coc.toFixed(1)}%`, 'Yearly cash flow on your cash in is healthy by common rules of thumb. Check that vacancy and repairs are realistic.');
  if (c.dscr < 1.0) add('bad', `DSCR of ${c.dscr.toFixed(2)}: rent does not cover the loan`, 'DSCR is NOI divided by loan payments. Under 1.0 the property does not pay its own mortgage. Many investor and DSCR lenders want 1.2 to 1.25 or more.');
  else if (c.dscr < 1.25) add('warn', `DSCR of ${c.dscr.toFixed(2)} is thin`, 'Many investor and DSCR lenders want 1.2 to 1.25 or more. A small rise in vacancy or costs could take you below 1.0.');
  if (c.cap < i.rate) add('warn', `Negative leverage: cap rate ${c.cap.toFixed(2)}% is below the ${i.rate}% loan rate`, 'The loan costs more than the property earns, so borrowing lowers your cash return. It can still work if rent and price growth make up the gap.');
  if (i.down < 15) add('warn', `Down payment of ${i.down}% is below what most investment loans allow`, 'Fannie Mae\'s eligibility matrix (checked Nov 2026) allows up to 85% loan-to-value on a one-unit investment property purchase, and 75% on two to four units. Lenders often ask for more, and rates are higher than for a home you live in.');
  if (i.vacancy < 5) add('warn', `Vacancy of ${i.vacancy}% is thin`, 'Even a good rental sits empty between tenants. 5 to 8% is a common allowance.');
  if (i.maint + i.capex < 10) add('warn', `Repairs and reserves are only ${(i.maint + i.capex).toFixed(0)}% of rent`, 'Maintenance plus a reserve for big items (roof, HVAC, water heater) commonly runs 10 to 20% of rent, more for older homes.');
  if (i.mgmt <= 0) add('warn', 'No property management included', 'Even if you self-manage, a fee of 8 to 10% of rent shows what the deal earns if you stop. Add it to see the return without your free labour.');
  if (i.reps) add('info', 'Real estate professional status is switched on', 'Losses are treated as non-passive, so they offset your other income with no $25,000 cap. This only applies if you meet the 750-hour and more-than-half-your-work-time tests and materially participate. Ask a tax adviser.');
  else if (c.passive < US_TAX.passive.allowance && c.y1.taxable < 0)
    add('warn', `Rental losses are partly blocked by the passive loss rules`, `Your income of ${m(i.otherIncome)} cuts the $25,000 rental loss allowance to ${m(c.passive)}. Losses you cannot use now are carried forward and used against later rental profit or when you sell.`);
  else if (c.y1.taxable < 0) add('info', 'Paper loss from depreciation', `Depreciation of ${m(c.dep)} a year can turn a profit into a tax loss. This calculator assumes you can use up to ${m(c.passive)} of it against other income. Check with a tax professional.`);
  add('info', `Cash needed to close: ${m(c.cash)}`, `Down payment ${m(c.down)}, closing costs ${m(c.closing)} and any repairs. Closing costs here are a rough percentage, so get a Loan Estimate from a lender.`);
  return out;
}

if (typeof module !== 'undefined') module.exports = { ucalc, uflags, USTRESS, fedTax, ltcgTax, usPmt, US_TAX, US_STATES, marginal };
