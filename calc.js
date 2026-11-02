// Calculation engine. Formulas recovered from the original app's bundle (see notes in index.html "How it works").
const STEP = { // [threshold, base, % per $100 above threshold]
  NSW: [[0,0,1.25],[17e3,212,1.5],[37e3,512,1.75],[99e3,1597,3.5],[372e3,11152,4.5],[1240e3,50212,5.5]],
  QLD: [[0,0,0],[5e3,0,1.5],[75e3,1050,3.5],[540e3,17325,4.5],[1e6,38025,5.75]],
  TAS: [[0,50,0],[3e3,50,1.75],[25e3,435,2.25],[75e3,1560,3.5],[200e3,5935,4],[375e3,12935,4.25],[725e3,27810,4.5]],
  WA:  [[0,0,1.9],[120e3,2280,2.85],[150e3,3135,3.8],[360e3,11115,4.75],[725e3,28453,5.15]],
};
const MARGINAL = { // [from, %] marginal duty
  SA:  [[0,1],[12e3,2],[30e3,3],[50e3,3.5],[100e3,4],[200e3,4.25],[250e3,4.75],[300e3,5],[500e3,5.5]],
  ACT: [[0,2.2],[200e3,4.5]],
  NT:  [[0,4.95],[525e3,5.45]],
};
const LAND_TAX = { // [from, %] marginal, applied to purchase price as the original does
  NSW: [[0,0],[822e3,1.6],[3357e3,2]],
  VIC: [[0,0],[300e3,0.2],[600e3,0.3],[1e6,0.25]],
  QLD: [[0,0],[350e3,1],[2250e3,1.75]],
  WA:  [[0,0],[300e3,0.25]],
  SA:  [[0,0],[25e3,0.5]],
  TAS: [[0,0],[25e3,0.55]],
  ACT: [[0,0.634]],
  NT:  [],
};
const marginal = (p, t) => t.reduce((d, [f, r], i) => {
  const to = i + 1 < t.length ? t[i + 1][0] : Infinity;
  return p > f ? d + (Math.min(p, to) - f) * r / 100 : d;
}, 0);

function stampDuty(p, st) {
  if (st === 'VIC') {
    if (p <= 25e3) return p * 0.014;
    if (p <= 130e3) return 350 + (p - 25e3) * 0.024;
    if (p <= 960e3) return 2870 + (p - 130e3) * 0.06;
    if (p <= 2e6) return p * 0.055;
    return 110e3 + (p - 2e6) * 0.065;
  }
  if (STEP[st]) {
    let row = STEP[st][0];
    for (const r of STEP[st]) if (p > r[0]) row = r;
    return row[1] + Math.ceil((p - row[0]) / 100) * row[2];
  }
  return marginal(p, MARGINAL[st]);
}
const landTax = (p, st, invest) => (invest ? marginal(p, LAND_TAX[st]) : 0);

const pmt = (P, rate, yrs) => {
  if (P <= 0 || rate < 0 || yrs <= 0) return 0;
  const m = rate / 1200, n = yrs * 12;
  return m === 0 ? P / n : P * m * (1 + m) ** n / ((1 + m) ** n - 1);
};

function depreciation(i) {
  const t = i.tax / 100, cw = i.construction * 0.025, rows = [];
  let rem = i.pne;
  for (let y = 1; y <= 40; y++) {
    let pe = 0;
    if (y <= 15 && rem > 0) {
      pe = Math.min(i.method === 'dv' ? rem * 0.2 : i.pne * 0.1, rem);
      rem -= pe;
    }
    const total = cw + pe;
    rows.push({ y, cw, pe, total, save: total * t });
  }
  return {
    rows, y1: rows[0].total, y1save: rows[0].save,
    ten: rows.slice(0, 10).reduce((a, r) => a + r.total, 0),
    life: rows.reduce((a, r) => a + r.total, 0),
  };
}

// After-tax cash flow. The original treats the whole cash loss (incl. principal) as deductible.
const afterTax = (rent, exp, loan, i, save) => {
  const r = rent - exp - loan;
  return r + save + (r < 0 && i.invest ? -r * i.tax / 100 : 0);
};
const afterTaxYear = (rent, exp, loan, i, dp, y) => {
  const g = 1 + i.infl / 100;
  return afterTax(rent * g ** y, exp * g ** y, loan, i, dp.rows[y - 1].save);
};

function payoff(loan, rate, yrs, extraMonthly, yearEndLump = 0) {
  const m = rate / 1200, p = pmt(loan, rate, yrs);
  let bal = loan, interest = 0, n = 0;
  while (bal > 0.01 && n < yrs * 12) {
    const int = bal * m;
    interest += int;
    const pay = p + extraMonthly;
    bal = pay >= bal + int ? 0 : bal - (pay - int);
    n++;
    if (n % 12 === 0 && yearEndLump > 0) bal = Math.max(0, bal - yearEndLump);
  }
  return { years: Math.ceil(n / 12), interest, std: p * yrs * 12 - loan };
}

function equitySeries(i, monthly) {
  const loan = i.price - i.deposit, m = i.rate / 1200, out = [{ y: 0, value: i.price, debt: loan, equity: i.price - loan }];
  let bal = loan;
  for (let y = 1; y <= Math.min(i.term, 30); y++) {
    for (let k = 0; k < 12 && bal > 0; k++) bal = Math.max(0, bal - Math.min(monthly - bal * m, bal));
    const v = i.price * (1 + i.growth / 100) ** y;
    out.push({ y, value: v, debt: bal, equity: v - bal });
  }
  return out;
}

function cgt(i, sale) {
  const gain = Math.max(0, sale - (i.price + i.acq));
  const discount = i.invest;
  const taxable = discount ? gain / 2 : gain;
  const tax = taxable * i.tax / 100;
  const costs = sale * 0.03;
  return { gain, discount, taxable, tax, costs, net: sale - costs - tax, eff: gain > 0 ? tax / gain * 100 : 0 };
}

function sensitivity(i, opts) {
  // opts: {rate:-1|0|1, growth:-1|0|1, vacancy:bool, exp:bool}
  const loan = i.price - i.deposit, exp0 = i.council + i.insurance + i.maintenance + i.other;
  const invested = i.deposit + i.acq, dp = depreciation(i);
  const run = (o) => {
    const rate = Math.max(0.1, i.rate + o.rate), growth = Math.max(0, i.growth + o.growth);
    const rent = i.weekly * (o.vacancy ? 50 : 52), exp = exp0 * (o.exp ? 1.1 : 1);
    const cf = afterTax(rent, exp, pmt(loan, rate, i.term) * 12, i, dp.y1save);
    const value = i.price * (1 + growth / 100) ** 10;
    return { weekly: cf / 52, roi: invested > 0 ? cf / invested * 100 : 0,
      ret: invested > 0 ? (value + cf * 10 - invested) / invested / 10 * 100 : 0 };
  };
  const base = run({ rate: 0, growth: 0 }), cur = run(opts);
  return { base, cur, one: (o) => run({ rate: 0, growth: 0, ...o }) };
}

function calc(i) {
  const loan = i.price - i.deposit, exp = i.council + i.insurance + i.maintenance + i.other;
  const rent = i.weekly * 52, monthly = pmt(loan, i.rate, i.term), annualLoan = monthly * 12;
  const dp = depreciation(i);
  const duty = stampDuty(i.price, i.state), lt = landTax(i.price, i.state, i.invest);
  const invested = i.deposit + i.acq;
  const cf = afterTax(rent, exp, annualLoan, i, dp.y1save);
  const ng = Math.max(0, -(rent - exp - annualLoan)) * (i.invest ? i.tax / 100 : 0);
  const value10 = i.price * (1 + i.growth / 100) ** 10;
  let cf10 = 0;
  for (let y = 1; y <= 10; y++) cf10 += afterTaxYear(rent, exp, annualLoan, i, dp, y);

  const ioM = loan * i.rate / 1200, after = i.term - i.ioYears;
  const piAfter = after > 0 ? pmt(loan, i.rate, after) : 0;
  const piInt = monthly * i.term * 12 - loan;
  const ioInt = ioM * i.ioYears * 12 + (after > 0 ? piAfter * after * 12 - loan : 0);
  const loans = {
    pi: { monthly, annual: annualLoan, cf: rent - annualLoan - exp, roi: invested > 0 ? (rent - annualLoan - exp) / invested * 100 : 0, interest: piInt },
    io: { monthly: ioM, annual: ioM * 12, cf: rent - ioM * 12 - exp, roi: invested > 0 ? (rent - ioM * 12 - exp) / invested * 100 : 0, interest: ioInt, after: piAfter },
  };

  const extraM = i.extraFreq === 'w' ? i.extra * 52 / 12 : i.extraFreq === 'f' ? i.extra * 26 / 12 : i.extra;
  const extra = extraM > 0 ? payoff(loan, i.rate, i.term, extraM) : null;
  const taxPay = payoff(loan, i.rate, i.term, 0, dp.y1save);

  return {
    loan, exp, rent, annualLoan, dp, duty, lt, invested, cf, ng, value10, cf10,
    lvr: loan / i.price * 100, netYield: (rent - exp) / i.price * 100, grossYield: rent / i.price * 100,
    equity10: value10 - i.price, totalReturn: value10 - i.price + cf10,
    loans, extra, taxPay, series: equitySeries(i, monthly),
    scen: [-2, 0, 2].map((d) => ({ rate: i.growth + d, rows: [10, 20, 30].map((y) => {
      const v = i.price * (1 + (i.growth + d) / 100) ** y; return { y, v, pct: (v - i.price) / i.price * 100 };
    }) })),
    cgt: cgt(i, value10),
  };
}

// Plain-English sanity checks. lvl: bad | warn | ok | info.
function flags(i, c) {
  const out = [], m = (n) => '$' + Math.round(Math.abs(n)).toLocaleString('en-AU');
  const add = (lvl, head, why) => out.push({ lvl, head, why });
  const wk = c.cf / 52, preTaxWk = (c.rent - c.exp - c.annualLoan) / 52;
  if (wk < -100) add('bad', `Costs you ${m(wk)} a week after tax`, 'You fund the shortfall from your own income, every week, for as long as you hold it. Check you could still carry it after a rate rise or a vacancy.');
  else if (wk < -0.5) add('warn', `Costs you ${m(wk)} a week after tax`, 'A small top-up each week. Fine if you can afford it, but it only gets better if rent grows faster than costs.');
  else if (wk > 0.5) add('ok', `Pays you ${m(wk)} a week after tax`, 'Positive cash flow means the property carries itself, which leaves you room if something goes wrong.');
  if (preTaxWk < 0 && wk >= 0) add('warn', 'Only positive because of tax benefits', 'Before tax benefits this property loses money. The refund depends on your income, and depreciation mostly applies to new builds.');
  if (c.netYield < 3.5) add('warn', `Net yield is low at ${c.netYield.toFixed(2)}%`, 'Rent after running costs is small compared with the price, so you are mainly relying on capital growth to make this work.');
  else if (c.netYield >= 4.5) add('ok', `Net yield of ${c.netYield.toFixed(2)}% is healthy`, 'Rent covers a good share of the price each year, so you are not relying on growth alone.');
  if (c.lvr > 80) add(c.lvr >= 90 ? 'bad' : 'warn', `LVR of ${c.lvr.toFixed(0)}%: expect mortgage insurance`, 'Above 80% most lenders charge lenders mortgage insurance, a one-off cost that is not included in these numbers.');
  const stressed = afterTax(c.rent, c.exp, pmt(c.loan, i.rate + 3, i.term) * 12, i, c.dp.y1save) / 52;
  add(stressed < -150 ? 'warn' : 'info', `If rates rise 3%: ${stressed < 0 ? m(stressed) + ' a week out of pocket' : m(stressed) + ' a week in your pocket'}`, 'Lenders test your loan at a buffer above today\'s rate. This shows how exposed the deal is if rates move that far.');
  const share = c.exp / c.rent;
  if (share > 0.35) add('warn', `Running costs take ${(share * 100).toFixed(0)}% of rent`, 'A common rule of thumb is 20 to 30%. Units with strata fees often run higher, so check the real figures.');
  if (i.growth >= 8) add('warn', `Assumes ${i.growth}% growth every year`, 'That nearly doubles the value in 10 years with no downturns. Treat it as a best case and compare it with the 4% scenario.');
  if (i.pne > 0 && c.dp.y1save > 0) add('info', `Assumes a ${m(c.dp.y1save)} depreciation tax saving in year 1`, 'Plant and equipment deductions generally only apply to new or near-new properties. For an established home, get a quantity surveyor report and set plant and equipment to zero if needed.');
  add('info', `Cash needed to settle: ${m(i.deposit + i.acq + c.duty)}`, `Deposit, ${m(c.duty)} stamp duty and acquisition costs. Keep a buffer of a few months of repayments on top of this.`);
  return out;
}

if (typeof module !== 'undefined') module.exports = { calc, sensitivity, stampDuty, landTax, pmt, flags };
