import { test, expect, expectNoSideScroll, expectTapTargets, isLandscape } from "../fixtures";

const PAGES = [
  { path: "/", title: "Dashboard", tab: "Dashboard" },
  { path: "/pipeline", title: "Pipeline", tab: "Pipeline" },
  { path: "/deals", title: "Deals", tab: "Deals" },
  { path: "/contacts", title: "Contacts", tab: "Contacts" },
  { path: "/organizations", title: "Organizations", tab: "Orgs" },
];
/** Every page: its shell and its content fit a phone (N1). */
const ALL_PAGES: { path: string; title: string | RegExp }[] = [
  { path: "/", title: "Dashboard" },
  { path: "/pipeline", title: "Pipeline" },
  { path: "/deals", title: "Deals" },
  { path: "/contacts", title: "Contacts" },
  { path: "/organizations", title: "Organizations" },
  { path: "/contacts/1", title: /\w/ },
  { path: "/deals/1", title: /\w/ },
  { path: "/organizations/1", title: /\w/ },
];

for (const theme of ["light", "dark"] as const) {
  test(`TE38 every page's shell fits the phone, with 44 px tap targets, in ${theme}`, async ({ page }) => {
    await page.addInitScript((saved) => localStorage.setItem("accountable.theme", saved), theme);
    for (const { path, title } of ALL_PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expectNoSideScroll(page, { content: true });
      await expectTapTargets(page);
    }
  });
}

test("TE38 the dashboard's charts label every third month and open their tooltips on a tap", async ({ page }) => {
  await page.goto("/");
  const revenue = page.getByRole("region", { name: "Revenue won" });
  const chart = revenue.locator(".recharts-surface");
  await expect(chart).toBeVisible();
  // Recharts draws the axis text in a layer of its own, so the months are found by their names.
  const months = async () =>
    (await revenue.locator("svg text").allTextContents()).filter((t) => /^[A-Z][a-z]{2}$/.test(t));
  await expect.poll(months, { message: "every third of 12 months" }).toHaveLength(4);
  const box = (await chart.boundingBox())!;
  expect(box.x + box.width, "the chart fits the screen").toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect(revenue.locator(".chart-tooltip")).toBeVisible();
  await expect(revenue.locator(".chart-tooltip")).toContainText("won");

  const wonLost = page.getByRole("region", { name: "Deals won and lost" });
  await wonLost.scrollIntoViewIfNeeded();
  const bars = (await wonLost.locator(".recharts-surface").boundingBox())!;
  await page.touchscreen.tap(bars.x + bars.width * 0.6, bars.y + bars.height / 2);
  await expect(wonLost.locator(".chart-tooltip")).toContainText("lost");
});

test("TE38 the dashboard reads in H9's order: one column in portrait, two in landscape", async ({ page }) => {
  await page.goto("/");
  const order = ["Revenue won", "Follow-ups", "Recent activity", "Open pipeline by stage", "Sales funnel", "Deals won and lost"];
  const tops: number[] = [];
  const lefts = new Set<number>();
  for (const name of order) {
    const box = (await page.getByRole("region", { name }).boundingBox())!;
    tops.push(box.y);
    lefts.add(Math.round(box.x));
  }
  expect(tops, "each panel at or below the one before").toEqual([...tops].sort((a, b) => a - b));
  expect(lefts.size, "columns").toBe(isLandscape(page) ? 2 : 1);
  const tiles = page.getByRole("region", { name: "Headline figures" }).getByRole("link");
  const first = (await tiles.nth(0).boundingBox())!;
  const third = (await tiles.nth(2).boundingBox())!;
  if (!isLandscape(page)) expect(third.y, "the tiles are two by two").toBeGreaterThan(first.y + first.height);
});

test("TE39 the tab bar, or the rail in landscape, reaches every section with the current one marked", async ({
  page,
}) => {
  await page.goto("/");
  const sections = page.getByRole("navigation", { name: "Sections" });
  const box = (await sections.boundingBox())!;
  const viewport = page.viewportSize()!;
  if (isLandscape(page)) {
    expect(box.x, "the rail is on the left").toBe(0);
    expect(box.height, "the rail runs down the screen").toBeGreaterThan(viewport.height - 2);
    // The account circle sits at the rail's foot (U13), and a tap reaches it.
    const circle = page.getByRole("button", { name: "Account menu for Test User" });
    const at = (await circle.boundingBox())!;
    expect(at.x + at.width, "the circle is on the rail").toBeLessThanOrEqual(box.width);
    expect(at.y, "the circle is at the rail's foot").toBeGreaterThan(viewport.height / 2);
    await circle.click();
    await expect(page.getByRole("dialog", { name: "Account menu for Test User" })).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    expect(box.y + box.height, "the tab bar is at the bottom").toBeCloseTo(viewport.height, 0);
    expect(box.width, "the tab bar spans the screen").toBeGreaterThan(viewport.width - 2);
  }
  for (const { tab, title } of PAGES) {
    await sections.getByRole("link", { name: tab }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(sections.getByRole("link", { name: tab })).toHaveAttribute("aria-current", "page");
  }
});

const background = (selector: string) =>
  `getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backgroundColor`;

test("TE39 a first visit on a phone opens in AMOLED dark; a laptop-size window keeps the laptop's dark", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".panel").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  expect(await page.evaluate(background("body"))).toBe("rgb(0, 0, 0)");
  expect(await page.evaluate(background(".panel"))).toBe("rgb(11, 26, 31)");

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".tab-bar")).toHaveCount(0);
  expect(await page.evaluate(background("body"))).toBe("rgb(4, 35, 46)");
  expect(await page.evaluate(background(".panel"))).toBe("rgb(0, 0, 0)");
});
