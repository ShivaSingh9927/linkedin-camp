// Copies @firecms/neat's prebuilt ES module into public/vendor so the hero
// gradient loads it as-is at runtime. Bundling it lets Next's production
// minifier re-minify Neat's already-minified code, which breaks it: the
// canvas clears to the background colour but the gradient mesh never shows.
// Runs before `dev` and `build` (see package.json).
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkgJson = require.resolve("@firecms/neat/package.json");
const { version } = JSON.parse(readFileSync(pkgJson, "utf8"));
const source = readFileSync(path.join(path.dirname(pkgJson), "dist/index.es.js"), "utf8")
  // The source map isn't shipped, so drop the reference to it.
  .replace(/\n\/\/# sourceMappingURL=.*\s*$/, "\n");

const outDir = path.join(here, "../public/vendor");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "neat.js"), `/* @firecms/neat ${version} — copied by scripts/copy-neat.mjs */\n${source}`);
console.log(`copied @firecms/neat ${version} → public/vendor/neat.js`);
