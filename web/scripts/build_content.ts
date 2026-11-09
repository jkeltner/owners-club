// Reads the shared catalogs in the repo's content/ folder and writes them as one
// JSON file the app imports (src/content/generated.json, gitignored). The
// content is bundled at build time, so nothing reads YAML at runtime and the
// app shows the same concepts, lessons and lenses the prototype did.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const contentDir = path.resolve(process.cwd(), "..", "content");
const outFile = path.resolve(process.cwd(), "src", "content", "generated.json");

const read = (name: string) => parse(readFileSync(path.join(contentDir, name), "utf8")) as Record<string, unknown>;

const concepts = read("concepts.yaml");
const lenses = read("sector_lenses.yaml");
const themes = read("themes.yaml");
const scenarios = read("scenarios.yaml");
const glossary = read("glossary.yaml");
const lessons = read("lessons.yaml");

const generated = {
  concepts: concepts.concepts,
  rank_thresholds: concepts.rank_thresholds,
  lenses: lenses.lenses,
  themes: themes.themes,
  not_in_game: themes.not_in_game,
  scenarios: scenarios.scenarios,
  glossary: glossary.terms,
  lessons: lessons.lessons,
};

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(generated, null, 2) + "\n");
console.log(`[content] ${(generated.concepts as unknown[]).length} concepts, ${(generated.lessons as unknown[]).length} lessons, ${(generated.scenarios as unknown[]).length} scenarios → src/content/generated.json`);
