import type { Locator, Page } from "@playwright/test";
import { test, expect, accountCircle, accountMenu, chooseTheme, signIn } from "./fixtures";

// Every browser context starts with no theme saved, so each test opens in dark mode (M1).
const LIGHT_PAGE = "rgb(240, 244, 245)";
const DARK_PAGE = "rgb(4, 35, 46)";
const BLACK = "rgb(0, 0, 0)";
const SECTIONS = ["Dashboard", "Pipeline", "Deals", "Contacts", "Organizations"];
const THEME_KEY = "accountable.theme";

const html = (page: Page) => page.locator("html");
const background = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);
/** Opens the user menu and says which theme it shows as chosen. */
async function expectChosen(page: Page, name: "Light" | "Dark" | "System") {
  await accountCircle(page).click();
  await expect(accountMenu(page).getByRole("menuitemradio", { name })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(accountMenu(page)).toBeHidden();
}

test("TE23 a first visit opens in dark mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  expect(await background(page, "body")).toBe(DARK_PAGE);
  await expectChosen(page, "Dark");
});

test("TE24 Dark covers every section, and Light and Dark are each kept after a reload", async ({ page }) => {
  await page.goto("/");
  await chooseTheme(page, "Dark");

  const sections = page.getByRole("navigation", { name: "Sections" });
  for (const name of SECTIONS) {
    await sections.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    expect(await background(page, "body")).toBe(DARK_PAGE);
    expect(await background(page, "main :is(.panel, .card)")).toBe(BLACK);
  }

  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  expect(await background(page, "body")).toBe(DARK_PAGE);
  await expectChosen(page, "Dark");

  await chooseTheme(page, "Light");
  await expect(html(page)).not.toHaveAttribute("data-theme");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Organizations" })).toBeVisible();
  await expect(html(page)).not.toHaveAttribute("data-theme");
  expect(await background(page, "body")).toBe(LIGHT_PAGE);
  await expectChosen(page, "Light");
});

test("TE25 the saved theme is set before the app's own script runs", async ({ page }) => {
  await page.goto("/");
  await chooseTheme(page, "Light");
  // Serve the app's script empty: only index.html's inline script can set the theme now.
  await page.route("**/src/main.tsx", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  await page.reload();
  await expect(page.locator("#root")).toBeEmpty();
  await expect(html(page)).not.toHaveAttribute("data-theme");

  for (const [saved, device, dark] of [
    ["dark", "light", true],
    ["system", "light", false],
    ["system", "dark", true],
  ] as const) {
    await page.emulateMedia({ colorScheme: device });
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [THEME_KEY, saved]);
    await page.reload();
    await expect(page.locator("#root")).toBeEmpty();
    if (dark) await expect(html(page)).toHaveAttribute("data-theme", "dark");
    else await expect(html(page)).not.toHaveAttribute("data-theme");
  }
});

test("TE26 with storage blocked the app opens dark, the menu still works and nothing is logged", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
  });
  const logged: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) logged.push(message.text());
  });

  // With nothing stored, the session can't be read either, so the app opens on the sign-in screen.
  await page.goto("/");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await signIn(page);
  expect(await background(page, "body")).toBe(DARK_PAGE);
  await expectChosen(page, "Dark");

  await chooseTheme(page, "Light");
  expect(await background(page, "body")).toBe(LIGHT_PAGE);
  await expectChosen(page, "Light");
  await chooseTheme(page, "Dark");
  expect(await background(page, "body")).toBe(DARK_PAGE);
  expect(logged).toEqual([]);
});

test("TE27 the theme is chosen by keyboard: Tab to the circle, Enter, arrows and Space", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const circle = accountCircle(page);
  for (let presses = 0; presses < 15; presses++) {
    await page.keyboard.press("Tab");
    if (await circle.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(circle).toBeFocused();

  await page.keyboard.press("Enter");
  const menu = accountMenu(page);
  await expect(menu.getByRole("menuitemradio", { name: "Light" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(menu.getByRole("menuitemradio", { name: "Light" })).toBeChecked();
  await expect(html(page)).not.toHaveAttribute("data-theme");

  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitemradio", { name: "Dark" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu.getByRole("menuitemradio", { name: "Dark" })).toBeChecked();
  await expect(menu.getByRole("menuitemradio", { name: "Light" })).not.toBeChecked();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(circle).toBeFocused();
});

const MIDNIGHT = "rgb(7, 59, 76)";

const style = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);
const backgroundOf = (target: Locator) => target.evaluate((el) => getComputedStyle(el).backgroundColor);
/** The distinct values of a style property across every matching element. */
const stylesOf = (targets: Locator, property: string) =>
  targets.evaluateAll(
    (elements, name) => [...new Set(elements.map((el) => getComputedStyle(el).getPropertyValue(name)))],
    property,
  );

/** A token's value as the browser resolves it now, so the test doesn't copy tokens.css. */
const token = (page: Page, name: string) =>
  page.evaluate((name) => {
    const probe = document.createElement("i");
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);

/** Set on the window; a reload would clear it. */
const markPage = (page: Page) => page.evaluate(() => ((window as { kept?: boolean }).kept = true));
const pageWasKept = (page: Page) => page.evaluate(() => (window as { kept?: boolean }).kept === true);

test("TE28 panels, cards, dialogs, toasts and charts follow the theme without a reload", async ({ page }) => {
  await page.goto("/");
  const revenue = page.getByRole("img", { name: /^Revenue won per month/ });
  // With axis and tick lines off, the chart's only lines are its gridlines and its only text the axis labels.
  const gridlines = revenue.locator("line");
  const axisLabels = revenue.locator("text");
  await expect(gridlines.first()).toBeAttached();
  await markPage(page);
  await chooseTheme(page, "Light");
  const lightLine = await token(page, "--line");
  const lightMuted = await token(page, "--ink-muted");
  await chooseTheme(page, "Dark");

  expect(await style(page, "html", "color-scheme")).toBe("dark");
  expect(await backgroundOf(page.getByRole("region", { name: "Revenue won", exact: true }))).toBe(BLACK);
  const darkLine = await token(page, "--line");
  const darkMuted = await token(page, "--ink-muted");
  expect(darkLine).not.toBe(lightLine);
  expect(darkMuted).not.toBe(lightMuted);
  expect(await stylesOf(gridlines, "stroke")).toEqual([darkLine]);
  expect(await stylesOf(axisLabels, "fill")).toEqual([darkMuted]);

  await page.getByRole("button", { name: "Mark done" }).first().click();
  await expect(page.locator(".toast")).toBeVisible();
  expect(await background(page, ".toast")).toBe(MIDNIGHT);

  const sections = page.getByRole("navigation", { name: "Sections" });
  await sections.getByRole("link", { name: "Pipeline" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pipeline" })).toBeVisible();
  expect(await background(page, ".card")).toBe(BLACK);
  const addDeal = page.getByRole("button", { name: "Add deal", exact: true });
  expect(await addDeal.evaluate((el) => getComputedStyle(el).color)).toBe(MIDNIGHT);
  await addDeal.click();
  const sidePanel = page.getByRole("dialog", { name: "Add deal" });
  await expect(sidePanel).toBeVisible();
  expect(await backgroundOf(sidePanel)).toBe(BLACK);
  await page.keyboard.press("Escape");

  await sections.getByRole("link", { name: "Deals" }).click();
  const row = page.locator("tbody tr").first();
  await row.hover();
  await row.getByRole("button", { name: /^Delete / }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  expect(await backgroundOf(confirm)).toBe(BLACK);
  await page.getByRole("button", { name: "Cancel" }).click();

  expect(await pageWasKept(page)).toBe(true);
});

test("TE29 what was typed in a form stays when the theme changes", async ({ page }) => {
  await page.goto("/contacts");
  await page.locator("tbody tr").first().getByRole("link").first().click();
  const description = page.getByLabel("What happened");
  await description.fill("Called about the renewal");
  await markPage(page);

  await chooseTheme(page, "Light");
  await expect(description).toHaveValue("Called about the renewal");
  await chooseTheme(page, "Dark");
  await expect(description).toHaveValue("Called about the renewal");
  expect(await pageWasKept(page)).toBe(true);
});

test("TE37 System follows the device from light to dark and back, without a reload and after one", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await chooseTheme(page, "System");
  await expect(html(page)).not.toHaveAttribute("data-theme");
  await markPage(page);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  expect(await background(page, "body")).toBe(DARK_PAGE);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).not.toHaveAttribute("data-theme");
  expect(await background(page, "body")).toBe(LIGHT_PAGE);
  expect(await pageWasKept(page)).toBe(true);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(html(page)).not.toHaveAttribute("data-theme");
  await expectChosen(page, "System");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).not.toHaveAttribute("data-theme");
});

test("TE37 a light theme saved before this change still opens light", async ({ page }) => {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem("seeded") === null) {
      localStorage.setItem(key, "light");
      sessionStorage.setItem("seeded", "yes");
    }
  }, THEME_KEY);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(html(page)).not.toHaveAttribute("data-theme");
  expect(await background(page, "body")).toBe(LIGHT_PAGE);
  await expectChosen(page, "Light");
});
