import { test, expect, expectNoSideScroll, phoneRowNames, signIn, signInScreen, turnPhone } from "../fixtures";

// The journeys run at every size: portrait, landscape and 360 px (W4.1). A first visit on a
// phone is AMOLED dark, and TE38 covers light.

test("TE41 search for a contact, open them and log a call with a follow-up, in under 30 seconds", async ({ page }) => {
  await page.goto("/");
  const form = page.getByRole("dialog", { name: "Log activity" });

  // Back closes full-screen search and stays on the page (F8).
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("combobox")).toBeFocused();
  // Search fills the screen, over the tab bar or rail too.
  const covered = await page.getByRole("navigation", { name: "Sections" }).evaluate((bar) => {
    const box = bar.getBoundingClientRect();
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return Boolean(top?.closest("[role=search]"));
  });
  expect(covered, "search covers the tab bar").toBe(true);
  await page.goBack();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  const started = Date.now();
  await page.getByRole("button", { name: "Search" }).click();
  await page.keyboard.type("karen", { delay: 200 });
  await page.getByRole("option", { name: /Karen Willis/ }).click();
  await page.getByRole("button", { name: "Log activity" }).click();
  // The form opens with Call chosen and What happened focused (A7).
  await expect(form.getByRole("radio", { name: "Call" })).toBeChecked();
  await expect(form.getByLabel("What happened")).toBeFocused();
  await page.keyboard.type("Agreed pricing for 3 sites, sending contract", { delay: 200 });
  // A phone picks dates with its own picker, which Chrome's phone emulation doesn't show, so
  // the date is set directly here; picking it by hand is part of TM20 on a real phone.
  await form.getByLabel("Follow-up date").fill("2026-11-20");
  await form.getByRole("button", { name: "Log activity" }).click();
  await expect(form).toBeHidden();
  const entry = page.getByRole("region", { name: "Timeline" }).getByRole("listitem").first();
  await expect(entry).toContainText("Agreed pricing for 3 sites, sending contract");
  const seconds = (Date.now() - started) / 1000;
  console.log(`On a phone, logged a call with a follow-up in ${seconds.toFixed(1)} seconds`);
  expect(seconds).toBeLessThan(30);

  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText("Agreed pricing for 3 sites, sending contract").first()).toBeVisible();
});

test("TE43 turning the phone keeps a half-filled form, and a list's sort and page", async ({ page }) => {
  await page.goto("/contacts");
  await page.getByRole("button", { name: "Add contact" }).click();
  const form = page.getByRole("dialog", { name: "Add contact" });
  await form.getByLabel("Name").fill("Half Done");
  await form.getByLabel("Job title").fill("Buyer");
  await turnPhone(page);
  await expect(form.getByLabel("Name")).toHaveValue("Half Done");
  await expect(form.getByLabel("Job title")).toHaveValue("Buyer");
  await turnPhone(page);
  await expect(form.getByLabel("Name")).toHaveValue("Half Done");
  await form.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Sort by" }).click();
  await page.getByRole("button", { name: "Name, Z to A" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("26 to 40 of 40")).toBeVisible();
  const contacts = page.getByRole("list", { name: "Contacts" });
  const names = await phoneRowNames(contacts);
  await turnPhone(page);
  await expect(page.getByText("26 to 40 of 40")).toBeVisible();
  expect(await phoneRowNames(contacts)).toEqual(names);
  await expectNoSideScroll(page, { content: true });
});

test("TE44 the user menu's sheet: choose Light, close it with a tap outside, then sign out and back in", async ({
  page,
}) => {
  await page.goto("/deals");
  await page.getByRole("button", { name: "Account menu for Test User" }).click();
  const sheet = page.getByRole("dialog", { name: "Account menu for Test User" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await expect(sheet).toBeVisible();

  // A tap on the page above the sheet, which the sheet's scrim covers.
  await page.mouse.click(20, 20);
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: "Account menu for Test User" }).click();
  await sheet.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(signInScreen(page)).toBeVisible();
  await expectNoSideScroll(page, { content: true });
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1, name: "Deals" })).toBeVisible();
});
