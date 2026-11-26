import type { Page } from "@playwright/test";
import { test, expect, SIGNED_OUT, accountCircle, accountMenu, chooseTheme, signIn, signInScreen } from "./fixtures";

const expectTheme = async (page: Page, mode: string) => {
  if (mode === "dark") await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  else await expect(page.locator("html")).not.toHaveAttribute("data-theme");
};

// The fixture fails any test with a console error (G11). This one walks every
// page and opens every panel and dialog, so nothing is missed between the other tests,
// once in each mode (M3).
for (const mode of ["light", "dark"]) {
  test(`TE21 every page and action runs with no console errors in ${mode} mode`, async ({ page }) => {
    await page.goto("/");
    // The theme, switched through the open user menu, walked with the arrow keys first.
    await accountCircle(page).click();
    await expect(accountMenu(page)).toBeVisible();
    for (const key of ["ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "End", "Home"]) await page.keyboard.press(key);
    // Dark is the default, so the dark run switches to Light and back.
    if (mode === "dark") await chooseTheme(page, "Light");
    await chooseTheme(page, mode === "dark" ? "Dark" : "Light");
    const sections = page.getByRole("navigation", { name: "Sections" });
    for (const name of ["Dashboard", "Pipeline", "Deals", "Contacts", "Organizations"]) {
      await sections.getByRole("link", { name }).click();
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    }

    for (const [path, add, edit] of [
      ["/organizations", "Add organization", "Edit organization"],
      ["/contacts", "Add contact", "Edit contact"],
      ["/deals", "Add deal", "Edit deal"],
    ] as const) {
      await page.goto(path);
      await page.getByRole("button", { name: add }).first().click();
      await expect(page.getByRole("dialog", { name: add })).toBeVisible();
      await page.keyboard.press("Escape");
      const row = page.getByRole("rowgroup").nth(1).getByRole("row").first();
      await row.hover();
      await row.getByRole("button", { name: /^Edit / }).click();
      await expect(page.getByRole("dialog", { name: edit })).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
      await row.getByRole("button", { name: /^Delete / }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
      // Sort every column and page through.
      for (const header of await page.getByRole("columnheader").getByRole("button").all()) await header.click();
      if ((await page.getByRole("button", { name: "Next page" }).count()) > 0) {
        await page.getByRole("button", { name: "Next page" }).click();
      }
      await row.click();
      await expect(page.getByRole("region", { name: "Details" })).toBeVisible();
      await page.getByRole("region", { name: "Details" }).getByRole("button", { name: "Edit" }).click();
      await page.keyboard.press("Escape");
    }

    // Filters and the board's search.
    await page.goto("/contacts?status=customer");
    await page.goto("/deals?stage=lost");
    await page.goto("/pipeline");
    await page.getByRole("searchbox").fill("Wilson");
    await page.getByRole("button", { name: "Add deal in Won" }).click();
    await page.keyboard.press("Escape");

    // The top bar's search, with its results open, then with nothing found.
    const search = page.getByRole("search").getByRole("combobox", { name: "Search" });
    await search.fill("garcia");
    await expect(page.getByRole("listbox", { name: "Search results" }).getByRole("option").first()).toBeVisible();
    await search.press("ArrowDown");
    await expect(page.getByRole("option", { selected: true })).toHaveCount(1);
    await search.fill("xyzzy");
    await expect(page.getByRole("search").getByRole("paragraph").filter({ hasText: 'No organizations, contacts or deals match "xyzzy".' })).toBeVisible();
    await search.press("Escape");
    await expectTheme(page, mode);
  });
}

// The sign-in screen, signed out, in each mode, through to the app.
test.describe("signed out", () => {
  test.use(SIGNED_OUT);
  for (const mode of ["light", "dark"]) {
    test(`TE21 the sign-in screen runs with no console errors in ${mode} mode`, async ({ page }) => {
      if (mode === "light") await page.addInitScript(() => localStorage.setItem("accountable.theme", "light"));
      await page.goto("/contacts");
      await expect(signInScreen(page)).toBeVisible();
      await expectTheme(page, mode);
      await signIn(page);
      await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
      await expectTheme(page, mode);
    });
  }
});
