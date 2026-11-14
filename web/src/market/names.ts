// What players see for a company: a name people actually say, and one plain
// line on what it does. Hand-written entries (content/company_lines.yaml) win;
// everything else gets the member list's official name, tidied, and its
// industry as the line.
import { companyLines } from "@/content";

/** "Walt Disney Company (The)" → "Walt Disney Company"; "Nike, Inc." → "Nike"; "Lilly (Eli)" → "Eli Lilly". */
export function tidyName(official: string): string {
  let name = official.trim();
  name = name.replace(/\s*\(Class [A-Z]\)$/i, "");
  name = name.replace(/\s*\(The\)$/i, "");
  // "Lilly (Eli)": the list sorts some names by surname.
  const flipped = name.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (flipped) name = `${flipped[2]} ${flipped[1]}`;
  name = name.replace(/,?\s+(Inc\.?|Corporation|Corp\.?|plc|Ltd\.?|N\.V\.|S\.A\.)$/i, "");
  return name.trim() || official;
}

export const displayName = (ticker: string, official: string) => companyLines[ticker]?.name ?? tidyName(official);

/** The one-line "what it does": hand-written where we have one, else the industry. */
export const companyLine = (ticker: string, subIndustry: string, oneLiner?: string | null) => oneLiner ?? companyLines[ticker]?.line ?? subIndustry;

/** Lowercase letters and digits only, so "McDonald's" matches "mcdonalds". */
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
