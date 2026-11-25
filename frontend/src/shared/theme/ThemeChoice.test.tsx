// TF32 (spec M1): Light, Dark and System as a group, the chosen one selected.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { THEME_KEY } from "./mode";
import { ThemeChoice } from "./ThemeChoice";

const root = document.documentElement;

function renderChoice() {
  render(
    <div role="menu" aria-label="Account">
      <span id="theme-label">Theme</span>
      <ThemeChoice labelledBy="theme-label" />
    </div>,
  );
  return userEvent.setup();
}

const choice = (name: string) => screen.getByRole("menuitemradio", { name });

afterEach(() => {
  delete root.dataset.theme;
  localStorage.clear();
});

describe("ThemeChoice", () => {
  it("is a group named Theme with three choices, dark chosen until someone picks another", () => {
    renderChoice();
    const group = screen.getByRole("group", { name: "Theme" });

    expect(
      within(group)
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent),
    ).toEqual(["Light", "Dark", "System"]);
    expect(choice("Dark")).toBeChecked();
    expect(choice("Light")).not.toBeChecked();
  });

  it("selects the saved choice", () => {
    localStorage.setItem(THEME_KEY, "system");
    renderChoice();
    expect(choice("System")).toBeChecked();
  });

  it("applies a choice at once when clicked", async () => {
    const user = renderChoice();

    await user.click(choice("Light"));

    expect(choice("Light")).toBeChecked();
    expect(choice("Dark")).not.toBeChecked();
    expect(root).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("chooses with Enter or Space once the menu has moved focus to a choice", async () => {
    const user = renderChoice();

    choice("Light").focus();
    await user.keyboard("{Enter}");
    expect(choice("Light")).toBeChecked();

    choice("Dark").focus();
    await user.keyboard(" ");
    expect(choice("Dark")).toBeChecked();
    expect(root).toHaveAttribute("data-theme", "dark");
  });
});
