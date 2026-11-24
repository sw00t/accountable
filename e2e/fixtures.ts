import { test as base, expect, type BrowserContextOptions, type Page } from "@playwright/test";
import { API_PORT, TODAY, WEB_PORT } from "../playwright.config";

export const API = `http://127.0.0.1:${API_PORT}/api`;
export { TODAY };

/** Where the browser keeps the session (U3). */
export const SESSION_KEY = "accountable.session";

/** Local sign-in's one person (U7), as the sign-in screen fills them in. */
export const TEST_USER = { name: "Test User", email: "test@accountable.local", password: "local-test-only" };

type StorageState = Exclude<BrowserContextOptions["storageState"], string | undefined>;

/** For `test.use`: the test starts with nothing stored, so signed out. */
export const SIGNED_OUT: { storageState: StorageState } = { storageState: { cookies: [], origins: [] } };

/** The sign-in screen, as any address shows it while signed out (U1). */
export const signInScreen = (page: Page) => page.getByRole("heading", { level: 1, name: "Sign in" });

/** Signs in with the details the local sign-in screen comes filled with, and waits for the app. */
export async function signIn(page: Page) {
  await expect(signInScreen(page)).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
}

/** The access token a stored state carries, so API calls made by a test are signed in too. */
function accessToken(state: StorageState | string | undefined): string | null {
  if (typeof state !== "object") return null;
  const stored = state.origins.flatMap((origin) => origin.localStorage).find((item) => item.name === SESSION_KEY);
  return stored ? (JSON.parse(stored.value).access_token ?? null) : null;
}

type Options = {
  /** Console errors a test expects, such as a save failing on purpose. */
  allowConsoleErrors: RegExp[];
};

/**
 * Every test starts from fresh sample data, signed in as Test User, with today fixed and
 * the console watched: any error fails the test (G11).
 */
export const test = base.extend<Options & { consoleErrors: string[] }, { signedInState: StorageState }>({
  // Signs in once through the sign-in screen per worker, and every test reuses that browser state.
  signedInState: [
    async ({ browser }, use) => {
      const context = await browser.newContext({ baseURL: `http://localhost:${WEB_PORT}` });
      const page = await context.newPage();
      await page.goto("/");
      await signIn(page);
      await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
      const state = await context.storageState();
      await context.close();
      await use(state);
    },
    { scope: "worker" },
  ],
  storageState: async ({ signedInState }, use) => {
    await use(signedInState);
  },
  // Requests a test makes itself carry the same session as its page, or none when signed out.
  request: async ({ playwright, storageState }, use) => {
    const token = accessToken(storageState);
    const request = await playwright.request.newContext({
      extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });
    await use(request);
    await request.dispose();
  },
  allowConsoleErrors: [[], { option: true }],
  consoleErrors: [
    async ({ page, request, allowConsoleErrors }, use) => {
      const reset = await request.post(`${API}/testing/reset`, { headers: { "X-Local-Date": TODAY } });
      expect(reset.ok()).toBeTruthy();
      await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));

      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);

      const unexpected = errors.filter((text) => !allowConsoleErrors.some((pattern) => pattern.test(text)));
      expect(unexpected, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
