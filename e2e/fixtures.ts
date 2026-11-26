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

/** The initials circle in the top bar, which opens the user menu (U11). */
export const accountCircle = (page: Page) => page.getByRole("button", { name: `Account menu for ${TEST_USER.name}` });
export const accountMenu = (page: Page) => page.getByRole("menu", { name: `Account menu for ${TEST_USER.name}` });

/** Chooses a theme in the user menu (M1), then closes the menu. */
export async function chooseTheme(page: Page, name: "Light" | "Dark" | "System") {
  if ((await accountCircle(page).getAttribute("aria-expanded")) !== "true") await accountCircle(page).click();
  const choice = accountMenu(page).getByRole("menuitemradio", { name });
  await choice.click();
  await expect(choice).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(accountMenu(page)).toBeHidden();
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


// --- The phone view (spec N1 to N7) ---

/** Whether this test runs at a phone's size in landscape. */
export const isLandscape = (page: Page) => {
  const size = page.viewportSize();
  return size !== null && size.width > size.height;
};

/**
 * N1: nothing makes the page scroll sideways. A phone's browser widens its layout to fit
 * content that's too wide, so this compares with the phone's own width, not the window's.
 * With `content`, the page's own content must fit too, not only the shell around it.
 */
export async function expectNoSideScroll(page: Page, { content = false } = {}) {
  const width = page.viewportSize()!.width;
  const widths = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    layout: window.innerWidth,
    main: document.querySelector("main")?.scrollWidth ?? 0,
    mainBox: document.querySelector("main")?.clientWidth ?? 0,
  }));
  expect(widths.page, "the page is wider than the phone").toBeLessThanOrEqual(width);
  expect(widths.layout, "the browser zoomed out to fit something too wide").toBeLessThanOrEqual(width);
  if (content) expect(widths.main, "the page's content scrolls sideways").toBeLessThanOrEqual(widths.mainBox);
}

/** N3: every visible button, link and field inside `scope` is at least 44 by 44 px. */
export async function expectTapTargets(page: Page, scope = "body") {
  const small = await page.locator(scope).evaluateAll((roots) =>
    roots.flatMap((root) =>
      [...root.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [role=tab]")]
        .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed")
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && (box.width < 44 || box.height < 44))
        .map(({ el, box }) => `${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim()}" ${Math.round(box.width)}x${Math.round(box.height)}`),
    ),
  );
  expect(small, "tap targets under 44 by 44 px").toEqual([]);
}

/** Turns the phone: swaps the viewport's width and height (N5). */
export async function turnPhone(page: Page) {
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.height, height: size.width });
}

export { expect };
