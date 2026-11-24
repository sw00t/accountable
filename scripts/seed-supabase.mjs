// `npm run seed:supabase`: loads the sample data into the Supabase database in .env,
// after showing what's there and asking for "yes" (G15). The users table is kept.

import { spawnSync } from "node:child_process";
import { requireSettings, root, stop, supabaseEnv } from "./settings.mjs";

requireSettings("npm run seed:supabase");

const { error, status } = spawnSync("uv", ["run", "python", "-m", "app.seed_supabase"], {
  cwd: root,
  env: supabaseEnv(),
  stdio: "inherit",
});

if (error) {
  stop([
    "Accountable needs a tool called uv to run its backend, and it isn't installed yet.",
    "Install it by following https://docs.astral.sh/uv/getting-started/installation/",
  ]);
}
process.exit(status ?? 1);
