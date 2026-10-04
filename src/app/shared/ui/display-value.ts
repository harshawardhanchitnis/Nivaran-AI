// Display-only tidying of fact values for people. It never changes stored values, quotes,
// drafts or the linter: those keep the exact text from the documents.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-24" → "24 Sep 2026"; "INR 9,999.00" → "₹9,999"; "no" → "No". Anything else is unchanged. */
export function displayValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const text = value.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const month = MONTHS[Number(iso[2]) - 1];
    return month ? `${Number(iso[3])} ${month} ${iso[1]}` : text;
  }

  const money = /^(?:INR|Rs\.?|₹)\s*([\d,]+)(?:\.(\d{1,2}))?$/i.exec(text);
  if (money) {
    const rupees = Number(money[1]!.replace(/,/g, ''));
    if (Number.isFinite(rupees)) {
      const paise = money[2] && Number(money[2]) !== 0 ? `.${money[2].padEnd(2, '0')}` : '';
      return `₹${rupees.toLocaleString('en-IN')}${paise}`;
    }
  }

  if (/^(yes|no)$/i.test(text)) {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }
  return text;
}

/** Evidence labels for a fact, each shown once, in document order. */
export function uniqueEvidence(sources: readonly { evidence: string }[]): string[] {
  return [...new Set(sources.map((source) => source.evidence))].sort();
}
