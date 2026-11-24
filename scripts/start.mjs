// `npm start`: runs the built app the way Render does (G13). The backend serves the built
// frontend and the API from one address, with Postgres on Supabase and Supabase sign-in.
// Run `npm run build` first. On Render, it listens on the port Render gives it.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { requireSettings, root, stop, supabaseEnv } from "./settings.mjs";

requireSettings("npm start");

if (!existsSync(join(root, "frontend", "dist", "index.html"))) {
  stop(["The frontend isn't built yet. Run npm run build first, then npm start."]);
}

const onRender = Boolean(process.env.RENDER);
const host = onRender ? "0.0.0.0" : "127.0.0.1";
const port = process.env.PORT || "8000";

if (!onRender) {
  console.log(`\nStarting Accountable at http://localhost:${port}\nPress Ctrl+C to stop.\n`);
}

const backend = spawn("uv", ["run", "uvicorn", "app.main:app", "--host", host, "--port", port], {
  cwd: root,
  env: supabaseEnv(),
  stdio: "inherit",
});

backend.on("error", () =>
  stop([
    "Accountable needs a tool called uv to run its backend, and it isn't installed yet.",
    "Install it by following https://docs.astral.sh/uv/getting-started/installation/",
  ]),
);
backend.on("exit", (code) => process.exit(code ?? 1));

// Pass Ctrl+C and Render's stop signal on, so the backend shuts down cleanly.
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => backend.kill(signal));
