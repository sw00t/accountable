import { test, expect, expectNoSideScroll, expectTapTargets, isLandscape } from "../fixtures";

const PAGES = [
  { path: "/", title: "Dashboard", tab: "Dashboard" },
  { path: "/pipeline", title: "Pipeline", tab: "Pipeline" },
  { path: "/deals", title: "Deals", tab: "Deals" },
  { path: "/contacts", title: "Contacts", tab: "Contacts" },
  { path: "/organizations", title: "Organizations", tab: "Orgs" },
];
/**
 * The pages whose shell fits the phone so far. The three lists join in PH2, when their tables
 * become lists on a phone (T8): Chrome widens a phone's layout to fit the laptop table.
 */
const SHELL_READY: { path: string; title: string | RegExp }[] = [
  { path: "/", title: "Dashboard" },
  { path: "/pipeline", title: "Pipeline" },
  { path: "/contacts/1", title: /\w/ },
  { path: "/deals/1", title: /\w/ },
  { path: "/organizations/1", title: /\w/ },
];

for (const theme of ["light", "dark"] as const) {
  test(`TE38 every page's shell fits the phone, with 44 px tap targets, in ${theme}`, async ({ page }) => {
    await page.addInitScript((saved) => localStorage.setItem("accountable.theme", saved), theme);
    for (const { path, title } of SHELL_READY) {
      await page.goto(path);
      const topBar = page.locator(".topbar");
      await expect(topBar.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expectNoSideScroll(page);
      await expectTapTargets(page, ".tab-bar");
      await expectTapTargets(page, ".topbar");
    }
  });
}

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
  } else {
    expect(box.y + box.height, "the tab bar is at the bottom").toBeCloseTo(viewport.height, 0);
    expect(box.width, "the tab bar spans the screen").toBeGreaterThan(viewport.width - 2);
  }
  for (const { tab, title } of PAGES) {
    await page.goto("/");
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
