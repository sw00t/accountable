import { test, expect, TEST_USER, accountCircle, accountMenu, signIn, signInScreen } from "./fixtures";

// Signing out here ends only this test's session: each test has its own browser context,
// and the shared signed-in state is never written back.
test("TE36 the circle shows TU; the menu shows the person, works by keyboard, and signs out keeping the theme", async ({
  page,
}) => {
  await page.goto("/contacts");
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
  const circle = page.getByRole("banner").getByRole("button", { name: `Account menu for ${TEST_USER.name}` });
  await expect(circle).toHaveText("TU");
  await expect(circle).toHaveAttribute("aria-haspopup", "menu");
  await expect(circle).toHaveAttribute("aria-expanded", "false");

  // A click opens it, showing the name and email; a click outside closes it.
  await circle.click();
  const menu = accountMenu(page);
  await expect(menu).toBeVisible();
  await expect(circle).toHaveAttribute("aria-expanded", "true");
  const banner = page.getByRole("banner");
  await expect(banner.getByText(TEST_USER.name, { exact: true })).toBeVisible();
  await expect(banner.getByText(TEST_USER.email, { exact: true })).toBeVisible();
  await expect(menu.getByRole("group", { name: "Theme" }).getByRole("menuitemradio")).toHaveText([
    "Light",
    "Dark",
    "System",
  ]);
  await page.getByRole("heading", { level: 1, name: "Contacts" }).click();
  await expect(menu).toBeHidden();
  await expect(circle).toBeFocused();

  // By keyboard: Enter opens it on Light; the arrows wrap; Home and End; Escape closes it.
  await page.keyboard.press("Enter");
  const item = (name: string) => menu.getByRole(name === "Sign out" ? "menuitem" : "menuitemradio", { name });
  await expect(item("Light")).toBeFocused();
  for (const [key, name] of [
    ["ArrowDown", "Dark"],
    ["ArrowDown", "System"],
    ["ArrowDown", "Sign out"],
    ["ArrowDown", "Light"],
    ["ArrowUp", "Sign out"],
    ["Home", "Light"],
    ["End", "Sign out"],
  ]) {
    await page.keyboard.press(key);
    await expect(item(name)).toBeFocused();
  }
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(circle).toBeFocused();

  // Choose Light, then sign out: the sign-in screen shows, still light.
  await page.keyboard.press("Space");
  await item("Light").click();
  await expect(item("Light")).toBeChecked();
  await expect(menu).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await item("Sign out").click();
  await expect(signInScreen(page)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");

  // Still signed out after a reload, and still light; signing in again works.
  await page.reload();
  await expect(signInScreen(page)).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
  await expect(accountCircle(page)).toHaveText("TU");
});
