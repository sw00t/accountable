// TF36 (N4): on a phone the sections are a tab bar; on a laptop, the sidebar as before.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setPhone } from "../test-setup";
import { list, mockApi, renderApp } from "./test-utils";

afterEach(() => vi.unstubAllGlobals());

const EMPTY = { ...list([]), status_counts: { all: 0, lead: 0, qualified: 0, customer: 0 } };

function sections() {
  return screen.getByRole("navigation", { name: "Sections" });
}

test("on a phone the five sections are in the tab bar, the current one marked", async () => {
  mockApi({ "GET /contacts": EMPTY, "GET /deals": list([]) });
  setPhone(true);
  renderApp("/contacts");

  const tabs = within(sections()).getAllByRole("link");
  expect(tabs.map((tab) => tab.textContent)).toEqual([
    "Dashboard",
    "Pipeline",
    "Deals",
    "Contacts",
    "Orgs",
  ]);
  expect(sections()).toHaveClass("tab-bar");
  expect(within(sections()).getByRole("link", { name: "Contacts" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.queryByText("Accountable")).not.toBeInTheDocument();

  await userEvent.click(within(sections()).getByRole("link", { name: "Deals" }));
  expect(within(sections()).getByRole("link", { name: "Deals" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("on a phone the page's title and main action sit in the top bar", async () => {
  mockApi({ "GET /contacts": EMPTY });
  setPhone(true);
  renderApp("/contacts");

  const topBar = screen.getAllByRole("banner")[0];
  expect(within(topBar).getByRole("heading", { level: 1, name: "Contacts" })).toBeInTheDocument();
  expect(within(topBar).getByRole("button", { name: "Add contact" })).toBeInTheDocument();
});

test("on a laptop the sidebar holds the sections and there's no tab bar", () => {
  mockApi({ "GET /contacts": EMPTY });
  renderApp("/contacts");

  expect(sections()).not.toHaveClass("tab-bar");
  expect(within(sections()).getByRole("link", { name: "Organizations" })).toBeInTheDocument();
  expect(screen.getByText("Accountable")).toBeInTheDocument();
});

test("turning a laptop window into a phone swaps the sidebar for the tab bar", () => {
  mockApi({ "GET /contacts": EMPTY });
  renderApp("/contacts");
  setPhone(true);
  expect(sections()).toHaveClass("tab-bar");
  setPhone(false);
  expect(sections()).not.toHaveClass("tab-bar");
});
