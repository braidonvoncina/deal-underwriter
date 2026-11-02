// Learning notes for US tax topics. Statute points below were read from law.cornell.edu / irs.gov (see CLAUDE.md).
function usTopics() {
  const t = (title, body) => `<details class="learn"><summary>${title}</summary>${body}</details>`;
  return sec('topics', 'Tax topics to learn', `
    <p class="note">General education, not tax advice. The first two topics are modelled in the Tax tab; the last two are not, so read them before you rely on the after-tax numbers.</p>
    ${t('1031 exchange (modelled)', `
      <p>Section 1031 lets you swap real property held for business or investment for like-kind real property without recognising the gain at that time. It does not apply to property held mainly for sale, and US and foreign property are not like kind.</p>
      <p>Timing is strict: you must identify the replacement within <b>45 days</b> of transferring the old property and receive it within <b>180 days</b> (or by your tax return due date if earlier).</p>
      <p><b>Boot</b> is cash or other property you take out. Gain is taxed up to the amount of boot. The calculator treats boot as taxed first as depreciation recapture, then as capital gain.</p>
      <p>The tax is deferred, not removed: your basis carries over, so there is a bigger gain and less depreciation later. The calculator shows the tax deferred, and its IRR assumes you keep the equity without paying that tax, so it flatters the return. Most people use a "qualified intermediary" to hold the sale money, which this tool does not model.</p>`)}
    ${t('Cost segregation and bonus depreciation (modelled)', `
      <p>A cost segregation study splits a building into parts: structural parts that depreciate over 27.5 or 39 years, and items such as flooring, fixtures and site work that depreciate faster. Under section 168(k), property with a recovery period of 20 years or less qualifies for a bonus deduction of 100% of its basis in the first year. The building itself does not qualify.</p>
      <p>Check the dates: the statute applies different rules depending on when property was acquired and placed in service. Confirm the current percentage with a tax adviser.</p>
      <p>Faster deductions are not free. Gain from short-life personal property is recaptured as <b>ordinary income</b> under section 1245 when you sell, instead of the 25% maximum for the building. The calculator treats all short-life parts as ordinary-rate recapture and depreciates the remainder over 10 years, a blended simplification of 5, 7 and 15 year items.</p>
      <p>Deductions only help if you can use them. A big paper loss is limited by the passive loss rules (see below) and is otherwise suspended and carried forward. Watch the "suspended losses" figure.</p>`)}
    ${t('20% pass-through deduction (not modelled)', `
      <p>Section 199A allows individuals a deduction equal to the lesser of the "combined qualified business income amount" or 20% of taxable income over net capital gain. It only applies to income from a <b>trade or business</b>. Whether a rental qualifies depends on the facts, such as how active and regular your involvement is, so a single rental often needs professional advice.</p>
      <p>Above certain income levels, limits based on wages paid and the cost of the property apply. The Cornell Law statute page I read showed the old end-of-2025 expiry removed by Public Law 119-21, but confirm the current rules and thresholds before relying on it.</p>
      <p>Why it is not in the calculator: it needs facts the calculator does not know (trade or business status, wages, other business income) and a wrong switch would overstate your return.</p>`)}
    ${t('Real estate professional status (not modelled)', `
      <p>Rental activity is normally "passive", so losses are limited as shown on the Tax tab. Under section 469(c)(7), rental real estate is not automatically passive if, in the year, more than half of your personal services in all trades or businesses are in real property trades or businesses in which you materially participate, <b>and</b> you perform more than <b>750 hours</b> there.</p>
      <p>You must still materially participate in the rental activity itself. Real property businesses include development, construction, acquisition, rental, operation, management, leasing and brokerage. Records of your hours matter, and this status draws scrutiny, particularly for people with a full-time job elsewhere.</p>
      <p>If it applies, losses, including those from cost segregation, can offset other income without the $25,000 cap. That is why cost segregation often pays off for real estate professionals and much less for other investors. Ask a tax adviser before assuming it.</p>`)}`);
}
