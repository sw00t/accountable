// Layout on a phone: in landscape the top bar reads title, filters, search, then the main
// action, in the order it's seen and tabbed to; in portrait the action stays by the title.
import { screen } from "@testing-library/react";
import { setPhone } from "../test-setup";
import { contactRow, list, mockApi, renderApp } from "./test-utils";

afterEach(() => vi.unstubAllGlobals());

function openContacts(shape: true | "landscape") {
  setPhone(shape);
  mockApi({
    "GET /contacts": {
      ...list([contactRow()]),
      status_counts: { all: 1, lead: 1, qualified: 0, customer: 0 },
    },
  });
  renderApp("/contacts");
}

/** The named controls in document order, which is the order they're read and tabbed to. */
function order(...elements: HTMLElement[]) {
  return [...elements].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

test("in landscape: title, filters, search, then Add", async () => {
  openContacts("landscape");
  const title = await screen.findByRole("heading", { level: 1, name: "Contacts" });
  const filters = await screen.findByRole("group", { name: "Filter by status" });
  const search = screen.getByRole("button", { name: "Search" });
  const add = screen.getByRole("button", { name: "Add contact" });
  expect(order(add, search, filters, title)).toEqual([title, filters, search, add]);
  expect(add.closest(".topbar-action")).not.toBeNull();
});

test("in portrait: Add sits by the title, before search", async () => {
  openContacts(true);
  const title = await screen.findByRole("heading", { level: 1, name: "Contacts" });
  const search = screen.getByRole("button", { name: "Search" });
  const add = screen.getByRole("button", { name: "Add contact" });
  expect(order(search, add, title)).toEqual([title, add, search]);
  expect(document.querySelector(".topbar-action")).toBeNull();
});
