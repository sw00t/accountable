import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// Every browser context starts with empty storage, so each test opens in light mode.
const LIGHT_PAGE = "rgb(240, 244, 245)";
const DARK_PAGE = "rgb(4, 35, 46)";
const BLACK = "rgb(0, 0, 0)";
const SECTIONS = ["Dashboard", "Pipeline", "Deals", "Contacts", "Organizations"];

const darkSwitch = (page: Page) => page.getByRole("switch", { name: "Dark mode" });
const background = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);

test("TE23 a first visit opens in light mode", async ({ page }) => {
  await page.goto("/");
  await expect(darkSwitch(page)).not.toBeChecked();
  expect(await background(page, "body")).toBe(LIGHT_PAGE);
});

test("TE24 dark mode covers every section and is remembered after a reload", async ({ page }) => {
  await page.goto("/");
  await darkSwitch(page).click();
  await expect(darkSwitch(page)).toBeChecked();

  const sections = page.getByRole("navigation", { name: "Sections" });
  for (const name of SECTIONS) {
    await sections.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    expect(await background(page, "body")).toBe(DARK_PAGE);
    expect(await background(page, "main :is(.panel, .card)")).toBe(BLACK);
  }

  await page.reload();
  await expect(darkSwitch(page)).toBeChecked();
  expect(await background(page, "body")).toBe(DARK_PAGE);

  await darkSwitch(page).click();
  await page.reload();
  await expect(darkSwitch(page)).not.toBeChecked();
  expect(await background(page, "body")).toBe(LIGHT_PAGE);
});

test("TE25 a saved dark mode is set before the app's own script runs", async ({ page }) => {
  await page.goto("/");
  await darkSwitch(page).click();
  // Serve the app's script empty: only index.html's inline script can set the mode now.
  await page.route("**/src/main.tsx", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await page.reload();
  await expect(page.locator("#root")).toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("TE26 with storage blocked the app opens light, the switch works and nothing is logged", async ({
  page,
}) => {
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

  await page.goto("/");
  await expect(darkSwitch(page)).not.toBeChecked();
  expect(await background(page, "body")).toBe(LIGHT_PAGE);

  await darkSwitch(page).click();
  await expect(darkSwitch(page)).toBeChecked();
  expect(await background(page, "body")).toBe(DARK_PAGE);
  await darkSwitch(page).click();
  await expect(darkSwitch(page)).not.toBeChecked();
  expect(await background(page, "body")).toBe(LIGHT_PAGE);
  expect(logged).toEqual([]);
});

test("TE27 the switch is reached with Tab and toggled with Space", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const toggle = darkSwitch(page);
  for (let presses = 0; presses < 10; presses++) {
    await page.keyboard.press("Tab");
    if (await toggle.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(toggle).toBeFocused();

  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
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

test("TE28 panels, cards, dialogs, toasts and charts follow the switch without a reload", async ({ page }) => {
  await page.goto("/");
  const revenue = page.getByRole("img", { name: /^Revenue won per month/ });
  // With axis and tick lines off, the chart's only lines are its gridlines and its only text the axis labels.
  const gridlines = revenue.locator("line");
  const axisLabels = revenue.locator("text");
  await expect(gridlines.first()).toBeAttached();
  const lightLine = await token(page, "--line");
  const lightMuted = await token(page, "--ink-muted");
  await markPage(page);
  await darkSwitch(page).click();

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

test("TE29 what was typed in a form stays when the mode changes", async ({ page }) => {
  await page.goto("/contacts");
  await page.locator("tbody tr").first().getByRole("link").first().click();
  const description = page.getByLabel("What happened");
  await description.fill("Called about the renewal");
  await markPage(page);

  await darkSwitch(page).click();
  await expect(description).toHaveValue("Called about the renewal");
  await darkSwitch(page).click();
  await expect(description).toHaveValue("Called about the renewal");
  expect(await pageWasKept(page)).toBe(true);
});
