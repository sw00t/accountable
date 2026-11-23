// TF21 (spec M1): the "Dark mode" switch.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitch } from "./ThemeSwitch";

const root = document.documentElement;

afterEach(() => {
  delete root.dataset.theme;
  localStorage.clear();
});

test("is a switch named Dark mode, off on a light page", () => {
  render(<ThemeSwitch />);
  expect(screen.getByRole("switch", { name: "Dark mode" })).not.toBeChecked();
});

test("is on when the page is already dark", () => {
  root.dataset.theme = "dark";
  render(<ThemeSwitch />);
  expect(screen.getByRole("switch", { name: "Dark mode" })).toBeChecked();
});

test("clicking turns dark mode on and off", async () => {
  const user = userEvent.setup();
  render(<ThemeSwitch />);
  const toggle = screen.getByRole("switch", { name: "Dark mode" });

  await user.click(toggle);
  expect(toggle).toBeChecked();
  expect(root).toHaveAttribute("data-theme", "dark");

  await user.click(toggle);
  expect(toggle).not.toBeChecked();
  expect(root).not.toHaveAttribute("data-theme");
});

test("Space turns dark mode on and off", async () => {
  const user = userEvent.setup();
  render(<ThemeSwitch />);
  const toggle = screen.getByRole("switch", { name: "Dark mode" });
  toggle.focus();

  await user.keyboard(" ");
  expect(toggle).toBeChecked();
  expect(root).toHaveAttribute("data-theme", "dark");

  await user.keyboard(" ");
  expect(toggle).not.toBeChecked();
  expect(root).not.toHaveAttribute("data-theme");
});
