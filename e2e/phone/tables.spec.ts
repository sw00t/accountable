import type { Page } from "@playwright/test";
import { test, expect, expectNoSideScroll, expectTapTargets } from "../fixtures";

const list = (page: Page) => page.locator(".phone-list");
const rows = (page: Page) => list(page).getByRole("listitem");
const names = (page: Page) => list(page).locator(".phone-row-name").allTextContents();

/** An open sheet or form fits the phone and every control in it is big enough to tap (TE38). */
async function expectFits(page: Page) {
  await expectNoSideScroll(page);
  await expectTapTargets(page, "[role=dialog], [role=alertdialog]");
}

test("TE40 contacts on a phone: search, filter, sort, paging, edit and delete", async ({ page }) => {
  await page.goto("/contacts");
  await expect(rows(page)).toHaveCount(25);
  await expect(page.getByText("1 to 25 of 40")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("26 to 40 of 40")).toBeVisible();

  // Search goes back to the first page and filters as you type (T1, T3).
  await page.getByRole("searchbox", { name: "Search contacts" }).fill("Karen");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Karen Willis");
  await page.getByRole("searchbox", { name: "Search contacts" }).fill("");

  // The status filter (C3): every row is a lead.
  await page.getByRole("group", { name: "Filter by status" }).getByRole("button", { name: /^Lead/ }).click();
  await expect
    .poll(async () => new Set(await list(page).locator(".phone-row-end").allTextContents()))
    .toEqual(new Set(["Lead"]));

  // Sort by, in both orders (T8).
  await page.getByRole("button", { name: "Sort by" }).click();
  await expectFits(page);
  await page.getByRole("button", { name: "Name, Z to A" }).click();
  await expect(page.getByRole("dialog", { name: "Sort by" })).toBeHidden();
  const descending = await names(page);
  expect(descending).toEqual([...descending].sort((a, b) => b.localeCompare(a)));

  // More, then Edit: the form opens full screen and saves (T5, Forms on a phone).
  const first = descending[0];
  await page.getByRole("button", { name: `More for ${first}` }).click();
  await expectFits(page);
  await page.getByRole("button", { name: "Edit" }).click();
  const form = page.getByRole("dialog", { name: "Edit contact" });
  await expect(form).toBeVisible();
  expect((await form.boundingBox())!.width).toBe(page.viewportSize()!.width);
  await expectFits(page);
  await form.getByLabel("Name").fill(`${first} Jr`);
  await form.getByRole("button", { name: "Save contact" }).click();
  await expect(form).toBeHidden();
  await expect(list(page).getByText(`${first} Jr`)).toBeVisible();

  // More, then Delete: the confirm sheet, then the row is gone (T6).
  await page.getByRole("button", { name: `More for ${first} Jr` }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expectFits(page);
  await confirm.getByRole("button", { name: "Delete contact" }).click();
  await expect(confirm).toBeHidden();
  await expect(list(page).getByText(`${first} Jr`)).toHaveCount(0);
});

test("TE40 the deals and organizations lists show their own second line and amount", async ({ page }) => {
  await page.goto("/deals");
  const deal = rows(page).first();
  await expect(deal.locator(".phone-row-detail")).toContainText(/(New|Qualified|Proposal|Negotiation|Won|Lost)$/);
  await expect(deal.locator(".phone-row-end")).toContainText(/^\$[\d,]+$/);
  await expectNoSideScroll(page, { content: true });

  await page.goto("/organizations");
  const org = rows(page).first();
  await expect(org.locator(".phone-row-end")).toContainText(/^\$[\d,]+$/);
  await org.locator(".phone-row-open").click();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Organizations" })).toBeVisible();
});

test("TE40 every field in the Add deal form fits inside the form", async ({ page }) => {
  await page.goto("/deals");
  await page.getByRole("button", { name: "Add deal" }).click();
  const form = page.getByRole("dialog", { name: "Add deal" });
  await expect(form.getByLabel("Close date")).toBeVisible();
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const outside = await form.evaluate((dialog) => {
    const edge = dialog.getBoundingClientRect();
    return [...dialog.querySelectorAll<HTMLElement>("input, select, textarea")]
      .filter((field) => field.offsetParent !== null)
      .filter((field) => {
        const box = field.getBoundingClientRect();
        return box.left < edge.left || box.right > edge.right + 0.5;
      })
      .map((field) => field.id || field.getAttribute("name"));
  });
  expect(outside, "fields past the form's edge").toEqual([]);
});
