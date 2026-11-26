// TF19 (spec M5, Colors): text meets its contrast rule on every surface it sits on, in both modes.
import { amoled, dark, light, type Tokens } from "./tokens.testing";

const SMALL = 4.5;
const LARGE = 3;

function luminance(hex: string) {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

type Pair = [text: string, surface: string, minimum: number];

const pairs = (text: string, surfaces: string[], minimum = SMALL): Pair[] =>
  surfaces.map((surface) => [text, surface, minimum]);

const TEXT_SHADES = ["sea-green", "marigold", "coral", "cerulean", "raspberry"];
const TINTS = ["sea-green", "marigold", "cerulean", "raspberry"];
const STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

/** Where each text color sits, by role, as in the spec's Colors table. */
const SHARED: Pair[] = [
  ...pairs("--ink", ["--page", "--panel", "--hover", "--table-head", "--field"]),
  ...pairs("--midnight", ["--sea-green", "--marigold", "--coral"]),
  ...pairs("--sea-mist", ["--midnight"]),
  ...pairs("--on-dark", ["--midnight", "--raspberry-fill", "--cerulean-fill"]),
  ...pairs("--on-dark", ["--cerulean", "--raspberry"], LARGE),
  ...pairs("--raspberry-on-dark", ["--midnight"], LARGE),
  // Status pills, prompts, the form error and tile icons: a text shade on its own tint.
  ...TINTS.map((name): Pair => [`--${name}-text`, `--tint-${name}`, SMALL]),
];

const BY_MODE: Record<string, { tokens: Tokens; pairs: Pair[] }> = {
  light: {
    tokens: light,
    // Light mode's secondary text and text shades are for white only (spec Colors).
    pairs: [
      ...SHARED,
      ...pairs("--ink-muted", ["--panel"]),
      ...TEXT_SHADES.map((name): Pair => [`--${name}-text`, "--panel", SMALL]),
    ],
  },
  dark: {
    tokens: dark,
    pairs: [
      ...SHARED,
      ...pairs("--ink-muted", ["--page", "--panel", "--hover", "--table-head", "--field"]),
      ...TEXT_SHADES.flatMap((name) => pairs(`--${name}-text`, ["--page", "--panel", "--hover"])),
      // Light mode's pale stages never met this on white and stay as they are (intent: light
      // looks exactly as before). The spec claims stage contrast for dark mode only.
      ...STAGES.flatMap((stage) => pairs(`--stage-${stage}`, ["--page", "--panel"], LARGE)),
    ],
  },
  // TF35: AMOLED dark on a phone (M6), on the black page, the panels and what's raised in them.
  amoled: {
    tokens: amoled,
    pairs: [
      ...SHARED,
      ...pairs("--ink", ["--raised"]),
      ...pairs("--ink-muted", [
        "--page",
        "--panel",
        "--raised",
        "--hover",
        "--table-head",
        "--field",
      ]),
      ...TEXT_SHADES.flatMap((name) => pairs(`--${name}-text`, ["--page", "--panel", "--raised"])),
      ...STAGES.flatMap((stage) =>
        pairs(`--stage-${stage}`, ["--page", "--panel", "--raised"], LARGE),
      ),
    ],
  },
};

describe.each(Object.entries(BY_MODE))("%s mode", (_mode, { tokens, pairs }) => {
  test.each(pairs)("%s on %s is at least %s:1", (text, surface, minimum) => {
    expect(contrast(tokens[text], tokens[surface])).toBeGreaterThanOrEqual(minimum);
  });
});

// The spec gives dark-mode contrast on the page; every other surface text sits on must only raise it.
test.each(["--panel", "--hover", "--table-head", "--field", ...TINTS.map((n) => `--tint-${n}`)])(
  "dark %s is no lighter than the dark page",
  (surface) => {
    expect(dark[surface]).toMatch(/^#[0-9a-f]{6}$/);
    expect(luminance(dark[surface])).toBeLessThanOrEqual(luminance(dark["--page"]));
  },
);
