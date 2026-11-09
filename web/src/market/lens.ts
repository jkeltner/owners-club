// Picks our sector lens (a `kind` in content/sector_lenses.yaml) from a
// company's GICS sector and sub-industry. Companies outside these nine kinds
// get null and the generic panel; the list grows as lenses are written.
export type LensKind =
  | "Software"
  | "Chipmakers"
  | "Retailers and restaurants"
  | "Consumer brands"
  | "Banks"
  | "Media and streaming"
  | "Drugmakers and biotech"
  | "Energy producers"
  | "Aerospace and defense";

const BY_SUB_INDUSTRY: Record<string, LensKind> = {
  "Application Software": "Software",
  "Systems Software": "Software",
  "Internet Services & Infrastructure": "Software",
  Semiconductors: "Chipmakers",
  "Semiconductor Materials & Equipment": "Chipmakers",
  Restaurants: "Retailers and restaurants",
  "Diversified Banks": "Banks",
  "Regional Banks": "Banks",
  "Movies & Entertainment": "Media and streaming",
  "Interactive Media & Services": "Media and streaming",
  "Interactive Home Entertainment": "Media and streaming",
  "Cable & Satellite": "Media and streaming",
  Broadcasting: "Media and streaming",
  Publishing: "Media and streaming",
  Advertising: "Media and streaming",
  Pharmaceuticals: "Drugmakers and biotech",
  Biotechnology: "Drugmakers and biotech",
  "Oil & Gas Exploration & Production": "Energy producers",
  "Integrated Oil & Gas": "Energy producers",
  "Aerospace & Defense": "Aerospace and defense",
  "Household Products": "Consumer brands",
  "Personal Care Products": "Consumer brands",
  "Packaged Foods & Meats": "Consumer brands",
  "Soft Drinks & Non-alcoholic Beverages": "Consumer brands",
  Brewers: "Consumer brands",
  "Distillers & Vintners": "Consumer brands",
  "Apparel, Accessories & Luxury Goods": "Consumer brands",
  Footwear: "Consumer brands",
  Tobacco: "Consumer brands",
  "Leisure Products": "Consumer brands",
  "Agricultural Products & Services": "Consumer brands",
};

export function lensFor(sector: string, subIndustry: string): LensKind | null {
  const exact = BY_SUB_INDUSTRY[subIndustry];
  if (exact) return exact;
  // GICS names every kind of store "... Retail".
  if (/Retail\b/.test(subIndustry) || /Department Stores|Hypermarkets/.test(subIndustry)) return "Retailers and restaurants";
  void sector;
  return null;
}
