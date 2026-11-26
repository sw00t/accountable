import { test, expect, dateKeys, typeKeys } from "./fixtures";

test("TE20 logging a call with a follow-up by keyboard at human typing speed takes under 30 seconds", async ({ page }) => {
  await page.goto("/contacts");
  await page.getByRole("searchbox").fill("Karen Willis");
  await page.getByRole("link", { name: "Karen Willis" }).click();
  const followUpKeys = await dateKeys(page, page.getByLabel("What happened"), page.getByLabel("Follow-up date"));

  const started = Date.now();
  // Into the form once, then keyboard only, typing at about 5 characters a second.
  await page.getByRole("radio", { name: "Call" }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.type("Agreed pricing for 3 sites, sending contract", { delay: 200 });
  await page.keyboard.press("Tab");
  await typeKeys(page, followUpKeys, 200);
  await page.keyboard.press("Enter");
  const entry = page.getByRole("region", { name: "Timeline" }).getByRole("listitem").first();
  await expect(entry).toContainText("Agreed pricing for 3 sites, sending contract");
  await expect(entry.getByLabel("Follow-up 20 Nov, due")).toBeVisible();
  const seconds = (Date.now() - started) / 1000;
  console.log(`Logged a call with a follow-up in ${seconds.toFixed(1)} seconds`);
  expect(seconds).toBeLessThan(30);
});
