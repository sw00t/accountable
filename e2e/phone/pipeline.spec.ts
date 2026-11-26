import type { Page } from "@playwright/test";
import { test, expect, expectNoSideScroll, expectTapTargets, cardNames } from "../fixtures";

const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
// Each card's link is named "<deal>, <value>".
const titles = (page: Page) => cardNames(page.getByRole("tabpanel").getByRole("link"));
/** A tab is named "<stage>, <count> deals". */
const tabCount = async (page: Page, name: string) =>
  Number(((await tab(page, name).getAttribute("aria-label")) ?? "").replace(/\D/g, ""));
const moveTo = (page: Page, name: string) => page.getByRole("button", { name: `Move to: ${name}` });
const sheet = (page: Page, name: string) => page.getByRole("dialog", { name: `Move "${name}" to` });
const money = (text: string | null) => Number((text ?? "").replace(/[^0-9]/g, ""));

/** Waits for the next move to save and the board to reload, as pipeline.spec.ts's does. */
function moveSaved(page: Page) {
  let moved = false;
  const saved = page
    .waitForResponse((r) => r.request().method() === "POST" && /\/api\/deals\/\d+\/move$/.test(new URL(r.url()).pathname))
    .then((r) => {
      moved = true;
      expect(r.status(), "move saved").toBe(200);
    });
  const reloaded = page.waitForResponse(
    (r) => moved && r.request().method() === "GET" && new URL(r.url()).pathname === "/api/deals",
  );
  return Promise.all([saved, reloaded]);
}

test("TE42 one stage at a time: Move to Won, Move up and Move down, all kept after a reload", async ({ page }) => {
  await page.goto("/pipeline");
  await expect(tab(page, "New")).toHaveAttribute("aria-selected", "true");
  await tab(page, "Negotiation").click();
  await expect(page).toHaveURL(/\?stage=negotiation$/);
  await expect(tab(page, "Negotiation")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel").getByRole("link").first()).toBeVisible();
  await expectNoSideScroll(page, { content: true });
  await expectTapTargets(page);

  // Move the first deal to Won: the stage and board totals change at once, and the message says so.
  const before = await titles(page);
  expect(before.length, "Negotiation has at least three deals").toBeGreaterThanOrEqual(3);
  const [first] = before;
  const stageValue = money(await page.getByTestId("column-value").textContent());
  const openValue = money(await page.getByTestId("board-value").textContent());
  const wonCount = await tabCount(page, "Won");
  await moveTo(page, first).click();
  await expect(sheet(page, first)).toBeVisible();
  await expectTapTargets(page, "[role=dialog]");
  await expectNoSideScroll(page);
  const saved = moveSaved(page);
  await sheet(page, first).getByRole("button", { name: "Won" }).click();
  await expect(page.getByText(`Moved ${first} to Won`)).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(before.slice(1));
  expect(money(await page.getByTestId("column-value").textContent())).toBeLessThan(stageValue);
  expect(money(await page.getByTestId("board-value").textContent())).toBeLessThan(openValue);
  await expect(tab(page, "Won")).toHaveAccessibleName(`Won, ${wonCount + 1} deals`);
  await expect(tab(page, "Negotiation")).toHaveAttribute("aria-selected", "true");
  await saved;

  // Move the last card up one place, then the (new) first card down one.
  const shown = await titles(page);
  const last = shown[shown.length - 1];
  let move = moveSaved(page);
  await moveTo(page, last).click();
  await expect(sheet(page, last).getByRole("button", { name: "Move down" })).toHaveCount(0);
  await sheet(page, last).getByRole("button", { name: "Move up" }).click();
  await move;
  const afterUp = [...shown];
  afterUp.splice(shown.length - 2, 2, last, shown[shown.length - 2]);
  await expect.poll(() => titles(page)).toEqual(afterUp);

  const top = afterUp[0];
  move = moveSaved(page);
  await moveTo(page, top).click();
  await expect(sheet(page, top).getByRole("button", { name: "Move up" })).toHaveCount(0);
  await sheet(page, top).getByRole("button", { name: "Move down" }).click();
  await move;
  const order = [afterUp[1], top, ...afterUp.slice(2)];
  await expect.poll(() => titles(page)).toEqual(order);

  // A reload keeps the stage, the move to Won and the order (P9, R11).
  await page.reload();
  await expect(tab(page, "Negotiation")).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => titles(page)).toEqual(order);
  await tab(page, "Won").click();
  await expect(page.getByRole("tabpanel").getByRole("link").first()).toHaveAccessibleName(new RegExp(`^${first}, `));
});

test("TE42 a card opens its deal, and Back returns to the same stage", async ({ page }) => {
  await page.goto("/pipeline?stage=proposal");
  const [name] = await titles(page);
  await page.getByRole("tabpanel").getByRole("link", { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(tab(page, "Proposal")).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/\?stage=proposal$/);
});
