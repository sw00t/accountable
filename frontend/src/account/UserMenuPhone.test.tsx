// TF45 (U13): on a phone the user menu opens as a sheet, with the same contents and keys.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setPhone } from "../test-setup";
import { renderSignedIn } from "../shared/test-utils";
import { UserMenu } from "./UserMenu";

const circle = () => screen.getByRole("button", { name: "Account menu for Test User" });

async function openSheet() {
  setPhone(true);
  const rendered = renderSignedIn(<UserMenu />);
  await userEvent.click(circle());
  return { ...rendered, sheet: screen.getByRole("dialog", { name: "Account menu for Test User" }) };
}

test("the menu opens in a sheet with the name, email, theme choice and Sign out", async () => {
  const { sheet } = await openSheet();
  expect(within(sheet).getByText("Test User")).toBeInTheDocument();
  expect(within(sheet).getByText("test@accountable.local")).toBeInTheDocument();
  expect(
    within(sheet)
      .getAllByRole("menuitemradio")
      .map((item) => item.textContent),
  ).toEqual(["Light", "Dark", "System"]);
  expect(within(sheet).getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
});

test("the sheet shows the initials circle beside the name (U13)", async () => {
  const { sheet } = await openSheet();
  expect(sheet.querySelector(".user-menu-avatar")).toHaveTextContent("TU");
});

test("the keys work as on a laptop: the arrows move, Escape closes and focus goes back", async () => {
  await openSheet();
  expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveFocus();
  await userEvent.keyboard("{ArrowDown}");
  expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveFocus();
  await userEvent.keyboard("{End}");
  expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(circle()).toHaveFocus();
});

test("choosing a theme keeps the sheet open; a tap inside doesn't close it, outside does", async () => {
  const { sheet } = await openSheet();
  await userEvent.click(within(sheet).getByRole("menuitemradio", { name: "Light" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await userEvent.click(sheet.parentElement!);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Sign out signs out", async () => {
  const { signOut } = await openSheet();
  await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
  expect(signOut).toHaveBeenCalledOnce();
});
