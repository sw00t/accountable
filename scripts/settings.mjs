// The settings `npm start` and `npm run seed:supabase` need (G14). They're read from the
// environment, after loading .env when it's there. Render sets them in its dashboard instead.
// Only the names are ever printed: DATABASE_URL holds the database password (R16).

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SETTINGS = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"];

export function stop(lines) {
  console.error("\n" + lines.join("\n") + "\n");
  process.exit(1);
}

// A setting already in the environment wins over the one in .env.
export function loadSettings() {
  const file = join(root, ".env");
  if (existsSync(file)) process.loadEnvFile(file);
  return SETTINGS.filter((name) => !process.env[name]?.trim());
}

export function requireSettings(command) {
  const missing = loadSettings();
  if (missing.length === 0) return;
  const [them, are] = missing.length === 1 ? ["it", "isn't"] : ["them", "aren't"];
  stop([
    `${command} needs ${andList(missing)}, and ${them} ${are} set.`,
    `Add ${them} to the .env file in the Accountable folder (.env.example lists the names),`,
    "or to the service's settings on Render.",
  ]);
}

function andList(names) {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// The environment for a backend that signs in with Supabase: never local sign-in (R1).
export function supabaseEnv() {
  const env = { ...process.env };
  delete env.ACCOUNTABLE_SIGN_IN;
  return env;
}
