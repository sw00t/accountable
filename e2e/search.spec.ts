import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const searchBox = (page: Page) => page.getByRole("search").getByRole("combobox", { name: "Search" });
const results = (page: Page) => page.getByRole("listbox", { name: "Search results" });
const group = (page: Page, name: string) => results(page).getByRole("group", { name });
const selected = (page: Page) => results(page).getByRole("option", { selected: true });

test("TE35 part of a name in another case finds an organization, a contact and a deal from the top bar", async ({
  page,
}) => {
  await page.goto("/");
  const box = searchBox(page);
  await expect(box).toHaveAttribute("placeholder", "Search organizations, contacts and deals");
  await expect(box).toHaveAttribute("aria-expanded", "false");

  await box.fill("gArCiA");
  await expect(results(page)).toBeVisible();
  await expect(box).toHaveAttribute("aria-expanded", "true");
  await expect(group(page, "Organizations").getByRole("option", { name: /Garcia Freight/ })).toBeVisible();
  await expect(group(page, "Contacts").getByRole("option", { name: /Sabrina Garcia/ })).toBeVisible();
  const deals = group(page, "Deals");
  await expect(deals.getByRole("option", { name: /Garcia data migration/ })).toBeVisible();
  await expect(deals.getByRole("option", { name: /Garcia hardware refresh/ })).toBeVisible();

  // Escape closes the results and keeps the text.
  await box.press("Escape");
  await expect(results(page)).toBeHidden();
  await expect(box).toHaveAttribute("aria-expanded", "false");
  await expect(box).toHaveValue("gArCiA");

  // Down opens the results again with nothing highlighted; the next Down highlights the
  // first result, and Up from the first wraps to the last.
  await box.press("ArrowDown");
  await expect(results(page)).toBeVisible();
  await expect(selected(page)).toHaveCount(0);
  await box.press("ArrowDown");
  const options = results(page).getByRole("option");
  await expect(selected(page)).toHaveCount(1);
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await box.press("ArrowUp");
  await expect(options.last()).toHaveAttribute("aria-selected", "true");
  await box.press("ArrowDown");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");

  // Down to the contact, then Enter opens it, and the box clears and closes.
  const sabrina = group(page, "Contacts").getByRole("option", { name: /Sabrina Garcia/ });
  for (let presses = 0; presses < 10; presses++) {
    if ((await sabrina.getAttribute("aria-selected")) === "true") break;
    await box.press("ArrowDown");
  }
  await expect(sabrina).toHaveAttribute("aria-selected", "true");
  await box.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Sabrina Garcia" })).toBeVisible();
  await expect(page).toHaveURL(/\/contacts\/\d+$/);
  await expect(box).toHaveValue("");
  await expect(results(page)).toBeHidden();

  // A click opens an organization and a deal too.
  await box.fill("freight");
  await group(page, "Organizations").getByRole("option", { name: /Garcia Freight/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Garcia Freight" })).toBeVisible();
  await expect(page).toHaveURL(/\/organizations\/\d+$/);

  await box.fill("HARDWARE REF");
  await group(page, "Deals").getByRole("option", { name: /Garcia hardware refresh/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Garcia hardware refresh" })).toBeVisible();
  await expect(page).toHaveURL(/\/deals\/\d+$/);

  // Nothing found says so, with no list.
  await box.fill("xyzzy");
  // Shown under the box, and said by the search's own status (toasts use role status too).
  const nothing = 'No organizations, contacts or deals match "xyzzy".';
  await expect(page.getByRole("search").getByRole("paragraph").filter({ hasText: nothing })).toBeVisible();
  await expect(page.getByRole("search").getByRole("status")).toHaveText(nothing);
  await expect(results(page)).toHaveCount(0);
});
