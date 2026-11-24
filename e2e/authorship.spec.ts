import { test, expect } from "./fixtures";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Today as the details panel writes it, such as `24 Nov 2026`. Records are stamped by the
 * backend's real clock, not the tests' fixed day, so this reads the real date, in UTC or
 * here, in case the test runs across midnight in one of them.
 */
function today(): RegExp {
  const now = new Date();
  const dates = new Set([
    `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
    `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
  ]);
  return new RegExp(`(${[...dates].join("|")})$`);
}

test("TE34 records and activities show who added them, and sample records show Sample data", async ({ page }) => {
  await page.goto("/contacts");
  await page.getByRole("button", { name: "Add contact" }).first().click();
  const panel = page.getByRole("dialog", { name: "Add contact" });
  await panel.getByLabel("Name").fill("Nadia Stamp");
  await panel.getByRole("button", { name: "Add contact" }).click();
  await expect(panel).toBeHidden();
  await page.getByRole("searchbox").fill("Nadia Stamp");
  await page.getByRole("link", { name: "Nadia Stamp" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nadia Stamp" })).toBeVisible();

  const details = page.getByRole("region", { name: "Details" });
  const added = details.getByText(/^Added by /);
  const changed = details.getByText(/^Last changed by /);
  await expect(added).toHaveText(/^Added by Test User on /);
  await expect(added).toHaveText(today());
  await expect(changed).toHaveText(/^Last changed by Test User on /);
  await expect(changed).toHaveText(today());

  await page.getByLabel("What happened").fill("Introduced ourselves");
  await page.getByRole("button", { name: "Log activity" }).click();
  const entry = page.getByRole("region", { name: "Timeline" }).getByRole("listitem").first();
  await expect(entry).toContainText("Introduced ourselves");
  await expect(entry).toContainText("Added by Test User");

  // A record from the sample data.
  await page.goto("/contacts");
  await page.getByRole("searchbox").fill("Karen Willis");
  await page.getByRole("link", { name: "Karen Willis" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Karen Willis" })).toBeVisible();
  await expect(details.getByText(/^Added by /)).toHaveText(/^Added by Sample data on \d{1,2} [A-Z][a-z]{2} \d{4}$/);
});
