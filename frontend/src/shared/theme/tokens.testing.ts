// For the token tests: tokens.css read from disk, one block per mode.
// The test setup turns CSS imports off (vite.config.ts, css: false).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const tokensCss = readFileSync(join(__dirname, "tokens.css"), "utf8");

export type Tokens = Record<string, string>;

function block(selector: string): Tokens {
  const start = tokensCss.indexOf(`${selector} {`);
  if (start < 0) return {};
  const body = tokensCss
    .slice(tokensCss.indexOf("{", start) + 1, tokensCss.indexOf("}", start))
    .replace(/\/\*[\s\S]*?\*\//g, "");
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()]),
  );
}

export const light = block(":root");
export const darkOverrides = block(':root[data-theme="dark"]');
/** Dark mode as the browser sees it: the light values with the dark block on top. */
export const dark: Tokens = { ...light, ...darkOverrides };
