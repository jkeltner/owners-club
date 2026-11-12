// Fills quarters the frames API leaves out, from one company's own facts
// (`/api/xbrl/companyfacts/CIK##########.json`, one call per company).
//
// The frames give one fact per company per calendar quarter, which loses a
// quarter in three real cases:
//   - Costco and AutoZone run 12-week quarters, so two fiscal quarters fall in
//     the same calendar quarter and only one gets a frame.
//   - A 10-Q's structured data never reaches the API (Dow, Edison International
//     and United Rentals have no second quarter of 2026), but the next 10-Q's
//     year-to-date figure does: the quarter is that figure minus the others.
//   - A line is tagged with a concept the frame lookup didn't match that quarter.
//
// Only companies whose trailing numbers are blank are looked up, so this is a
// few dozen calls a night, not five hundred.
import { CONCEPTS, type FinancialColumn, type FinancialUpsert, storedValue } from "./edgar";
import { fetchJson, sleep } from "./http";
import { frameForPeriod } from "./metrics";

export type Fact = { start?: string; end: string; val: number; accn: string; form: string; filed: string };
export type CompanyFacts = { cik: number; facts: Record<string, Record<string, { units: Record<string, Fact[]> }>> };

export async function fetchCompanyFacts(cik: number): Promise<CompanyFacts | null> {
  await sleep(150);
  try {
    return await fetchJson<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, "0")}.json`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("HTTP 404")) return null;
    throw err;
  }
}

// Lines that add up across quarters, so a year-to-date figure minus the
// quarters already known gives the missing one. Diluted shares are an average,
// not a sum: they are taken only from a quarter's own fact.
const ADDITIVE: FinancialColumn[] = ["revenue", "netIncome", "epsDiluted", "grossProfit", "operatingIncome", "operatingCashFlow", "capex"];
const DURATION: FinancialColumn[] = [...ADDITIVE, "sharesDiluted"];

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
const SLACK = 7;
const isQuarterLong = (start: string, end: string) => {
  const d = days(start, end) + 1;
  return d >= 80 && d <= 105;
};

type Span = { start: string; end: string };
type Stored = Pick<FinancialUpsert, "period" | "periodStart" | "periodEnd"> & Partial<Record<FinancialColumn, number | null>>;

/**
 * Quarter rows to upsert for one company: quarters that aren't stored, lines
 * a stored quarter is missing, and lines where the company's own fact for
 * exactly that period differs from what is stored. The last case is real: for
 * a 12-week filer the frames can put one fiscal quarter's revenue and the
 * next one's net income in the same row (Costco, early 2026). `since` limits
 * it to quarters ending on or after that date.
 */
export function quartersFromFacts(cik: number, facts: CompanyFacts["facts"], stored: Stored[], since: string): FinancialUpsert[] {
  // (start|end) -> column -> value, for quarter-long periods.
  const found = new Map<string, Span & { accn: string; values: Partial<Record<FinancialColumn, number>> }>();
  const put = (span: Span, column: FinancialColumn, val: number, accn: string) => {
    const key = `${span.start}|${span.end}`;
    const q = found.get(key) ?? { ...span, accn, values: {} };
    if (q.values[column] == null) q.values[column] = val;
    found.set(key, q);
  };

  for (const column of DURATION) {
    // Every 10-Q and 10-K fact for this line, preferred concept first; one per
    // period, the latest filing winning (a restatement replaces the original).
    const byPeriod = new Map<string, Fact & { start: string }>();
    for (const spec of CONCEPTS[column].sources) {
      const mine = new Map<string, Fact & { start: string }>();
      // The frames call the EPS unit "USD-per-shares"; a company's facts call it "USD/shares".
      const units = facts[spec.taxonomy]?.[spec.tag]?.units ?? {};
      for (const f of units[spec.unit] ?? units[spec.unit.replace("-per-", "/")] ?? []) {
        if (!f.start || !f.form.startsWith("10-") || f.end < since) continue;
        const key = `${f.start}|${f.end}`;
        const prev = mine.get(key);
        if (!prev || f.filed > prev.filed) mine.set(key, f as Fact & { start: string });
      }
      for (const [key, f] of mine) if (!byPeriod.has(key)) byPeriod.set(key, f);
    }
    const all = [...byPeriod.values()];
    const known: (Span & { val: number })[] = [];
    for (const f of all.filter((f) => isQuarterLong(f.start, f.end))) {
      const val = storedValue(column, f.val);
      if (val == null) continue;
      put({ start: f.start, end: f.end }, column, val, f.accn);
      known.push({ start: f.start, end: f.end, val });
    }
    if (!ADDITIVE.includes(column)) continue;
    // Year-to-date figures (six and nine months), shortest first, so a
    // six-month figure can supply the quarter a nine-month one then builds on.
    // Full years are left to `quarters()` in metrics.ts, which derives the
    // 10-K quarter when the numbers are read.
    const longer = all.filter((f) => days(f.start, f.end) + 1 > 105 && days(f.start, f.end) + 1 <= 290).sort((a, b) => days(a.start, a.end) - days(b.start, b.end));
    for (const f of longer) {
      const hole = oneHole({ start: f.start, end: f.end }, known);
      if (!hole) continue;
      const val = storedValue(column, f.val - hole.sum);
      if (val == null) continue;
      const rounded = column === "epsDiluted" ? Math.round(val * 100) / 100 : val;
      put(hole.span, column, rounded, f.accn);
      known.push({ ...hole.span, val: rounded });
    }
  }

  // Match each found quarter to a stored row, or name a new one.
  const taken = new Set(stored.map((r) => r.period));
  const out: FinancialUpsert[] = [];
  for (const q of [...found.values()].sort((a, b) => (a.end < b.end ? -1 : 1))) {
    const dated = stored.find((r) => r.periodStart && r.periodEnd && Math.abs(days(r.periodStart, q.start)) <= SLACK && Math.abs(days(r.periodEnd, q.end)) <= SLACK);
    // A stored row with no dates holds only balance-sheet values (shares
    // outstanding) under the calendar quarter's name; the quarter joins it.
    const undated = dated ? undefined : stored.find((r) => !r.periodStart && r.period === frameForPeriod(q.start, q.end));
    const match = dated ?? undated;
    const row: FinancialUpsert = { cik, period: match?.period ?? "" };
    let changed = false;
    for (const [column, val] of Object.entries(q.values) as [FinancialColumn, number][]) {
      if (match && match[column] === val) continue;
      (row as Record<string, unknown>)[column] = val;
      changed = true;
    }
    if (!changed) continue;
    if (undated) {
      row.periodStart = q.start;
      row.periodEnd = q.end;
      row.accession = q.accn;
    }
    if (!match) {
      // The calendar quarter holding most of the period; when another of this
      // company's quarters already has that name (12-week quarters), add "b".
      let period = frameForPeriod(q.start, q.end);
      if (taken.has(period)) period = `${period}b`;
      if (taken.has(period)) continue;
      taken.add(period);
      row.period = period;
      row.periodStart = q.start;
      row.periodEnd = q.end;
      row.accession = q.accn;
    }
    out.push(row);
  }
  return out;
}

/**
 * When the known quarters inside a longer period tile it except for one
 * quarter-sized hole, that hole and the sum of the others; else null.
 */
function oneHole(span: Span, known: (Span & { val: number })[]): { span: Span; sum: number } | null {
  const inside = known.filter((q) => days(span.start, q.start) >= -SLACK && days(q.end, span.end) >= -SLACK).sort((a, b) => (a.start < b.start ? -1 : 1));
  if (!inside.length) return null;
  const holes: Span[] = [];
  let cursor = span.start;
  for (const q of inside) {
    const gap = days(cursor, q.start);
    if (gap > SLACK) holes.push({ start: cursor, end: addDays(q.start, -1) });
    else if (gap < -SLACK) return null; // overlapping quarters: not a clean tiling
    cursor = addDays(q.end, 1);
  }
  if (days(cursor, span.end) + 1 > SLACK) holes.push({ start: cursor, end: span.end });
  if (holes.length !== 1) return null;
  const holeDays = days(holes[0].start, holes[0].end) + 1;
  if (holeDays < 80 || holeDays > 105) return null;
  return { span: holes[0], sum: inside.reduce((a, q) => a + q.val, 0) };
}
