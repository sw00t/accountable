// RV9 and the spec's Colors rule: every color is defined once, as a CSS variable in
// tokens.css. Components, charts and stylesheets only refer to those variables.
// Read from disk: the test setup turns CSS imports off (vite.config.ts, css: false).
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { dark, darkOverrides, light, tokensCss } from "./tokens.testing";

const SRC = join(__dirname, "../..");
const skip = (file: string) => /\.test\.tsx?$/.test(file) || file.endsWith("api-types.ts");
const sources: Record<string, string> = Object.fromEntries(
  (readdirSync(SRC, { recursive: true }) as string[])
    .filter((file) => /\.(ts|tsx|css)$/.test(file) && !skip(file))
    .map((file) => [relative(SRC, join(SRC, file)), readFileSync(join(SRC, file), "utf8")]),
);

const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi;
const defined = new Set([...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

test("the scan sees the app's files", () => {
  const files = Object.keys(sources);
  expect(files.some((f) => f.endsWith("dashboard/Charts.tsx"))).toBe(true);
  expect(files.some((f) => f.endsWith("theme/components.css"))).toBe(true);
  expect(files.length).toBeGreaterThan(40);
});

test.each(Object.entries(sources).filter(([file]) => !file.endsWith("theme/tokens.css")))(
  "%s uses color tokens, not color literals",
  (_file, text) => {
    // Comments may mention a color, for example the spec's Sea Green #06D6A0.
    const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code.match(COLOR_LITERAL) ?? []).toEqual([]);
  },
);

test.each(Object.entries(sources))("%s only uses tokens that exist", (_file, text) => {
  const used = [...text.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
  expect(used.filter((name) => !defined.has(name))).toEqual([]);
});

// TF18: the brand colors, Midnight and the fills behind white text (Concerns 13 and 15).
const SPEC_LIGHT = {
  "--sea-green": "#06d6a0",
  "--marigold": "#ffc145",
  "--coral": "#f78c6b",
  "--cerulean": "#118ab2",
  "--raspberry": "#ef476f",
  "--midnight": "#073b4c",
  "--sea-mist": "#cdd8db",
  "--raspberry-fill": "#c42350",
  "--cerulean-fill": "#0e7596",
  "--ink": "#073b4c",
  "--page": "#f0f4f5",
};

test("light mode's colors are the spec's", () => {
  expect(Object.fromEntries(Object.keys(SPEC_LIGHT).map((name) => [name, light[name]]))).toEqual(
    SPEC_LIGHT,
  );
});

test("the dark block only overrides tokens the light block defines", () => {
  expect(Object.keys(darkOverrides).length).toBeGreaterThan(0);
  expect(Object.keys(darkOverrides).filter((name) => !(name in light))).toEqual([]);
});

test("the brand colors, Midnight, Sea Mist and the fills are the same in dark mode", () => {
  const fixed = Object.keys(SPEC_LIGHT).filter((name) => name !== "--ink" && name !== "--page");
  expect(Object.fromEntries(fixed.map((name) => [name, dark[name]]))).toEqual(
    Object.fromEntries(fixed.map((name) => [name, light[name]])),
  );
});

test("dark mode's colors are the spec's", () => {
  const SPEC_DARK = {
    "--page": "#04232e",
    "--panel": "#000000",
    "--ink": "#cdd8db",
    "--ink-muted": "#8ea7af",
    "--sea-green-text": "#4be3b9",
    "--marigold-text": "#ffd27a",
    "--coral-text": "#ffa88c",
    "--cerulean-text": "#5ec2e6",
    "--raspberry-text": "#ff8fa8",
  };
  expect(Object.fromEntries(Object.keys(SPEC_DARK).map((name) => [name, dark[name]]))).toEqual(
    SPEC_DARK,
  );
});

test("dark mode reverses the open stages and keeps Won and Lost (Concern 14)", () => {
  const stages = (tokens: Record<string, string>) =>
    ["new", "qualified", "proposal", "negotiation", "won", "lost"].map(
      (stage) => tokens[`--stage-${stage}`],
    );
  const [newest, qualified, proposal, negotiation, won, lost] = stages(light);
  expect(stages(dark)).toEqual([negotiation, proposal, qualified, newest, won, lost]);
});
