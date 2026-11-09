// The S&P 500 member list, from Wikipedia's maintained table (ticker, name,
// GICS sector and sub-industry, CIK, date added). S&P's own list is behind a
// license; Wikipedia tracks the index changes within a day or two, and the
// nightly job diffs it against our `companies` table so a removed member is
// marked rather than deleted (players may still hold it).
import { fetchText, textOf } from "./http";
import { lensFor } from "./lens";

export type Sp500Member = {
  ticker: string; // Wikipedia's form, e.g. "BRK.B"
  name: string;
  sector: string;
  subIndustry: string;
  cik: number | null;
  addedToIndex: string | null; // YYYY-MM-DD
  lens: string | null;
};

export const SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";

export function parseSp500Table(html: string): Sp500Member[] {
  const table = html.match(/<table[^>]*id="constituents"[\s\S]*?<\/table>/)?.[0];
  if (!table) throw new Error("S&P 500 table not found on the Wikipedia page");
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  const header = cells(rows[0]).map((h) => h.toLowerCase());
  const col = (name: string) => {
    const i = header.findIndex((h) => h.startsWith(name));
    if (i < 0) throw new Error(`S&P 500 table has no "${name}" column; header is ${header.join(", ")}`);
    return i;
  };
  const iSymbol = col("symbol");
  const iName = col("security");
  const iSector = col("gics sector");
  const iSub = col("gics sub-industry");
  const iCik = col("cik");
  const iAdded = col("date added");

  const members: Sp500Member[] = [];
  for (const row of rows.slice(1)) {
    const c = cells(row);
    if (c.length <= Math.max(iSymbol, iName, iSector, iSub, iCik)) continue;
    const ticker = c[iSymbol].toUpperCase();
    if (!/^[A-Z][A-Z0-9.]{0,6}$/.test(ticker)) continue;
    const cik = Number.parseInt(c[iCik], 10);
    const added = c[iAdded]?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
    members.push({
      ticker,
      name: c[iName],
      sector: c[iSector],
      subIndustry: c[iSub],
      cik: Number.isFinite(cik) ? cik : null,
      addedToIndex: added,
      lens: lensFor(c[iSector], c[iSub]),
    });
  }
  if (members.length < 480 || members.length > 520) {
    throw new Error(`Parsed ${members.length} S&P 500 members; expected about 503. The page layout may have changed.`);
  }
  return members;
}

export async function fetchSp500Members(): Promise<Sp500Member[]> {
  return parseSp500Table(await fetchText(SP500_URL));
}

function cells(row: string) {
  return [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => textOf(m[1]));
}

// Ticker spellings differ by source: Wikipedia and Massive write "BRK.B",
// the SEC writes "BRK-B".
export const toSecTicker = (ticker: string) => ticker.replace(".", "-");
export const fromSecTicker = (ticker: string) => ticker.replace("-", ".");
