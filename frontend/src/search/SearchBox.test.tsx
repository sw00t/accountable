// TF27: the top bar's search box (F1, F3 to F7, R15).
import { act, fireEvent, screen, within } from "@testing-library/react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { renderSignedIn } from "../shared/test-utils";
import { SearchBox } from "./SearchBox";
import { PAUSE_MS, type SearchResults } from "./useSearch";

const GARCIA: SearchResults = {
  organizations: { items: [{ id: 3, name: "Garcia Freight", industry: "Logistics" }], total: 1 },
  contacts: {
    items: [{ id: 8, name: "Sabrina Garcia", organization_name: "Garcia Freight" }],
    total: 1,
  },
  deals: {
    items: [
      {
        id: 12,
        name: "Garcia data migration",
        organization_name: "Garcia Freight",
        stage: "proposal",
      },
      { id: 13, name: "Garcia hardware refresh", organization_name: null, stage: "won" },
    ],
    total: 2,
  },
};

const NOTHING: SearchResults = {
  organizations: { items: [], total: 0 },
  contacts: { items: [], total: 0 },
  deals: { items: [], total: 0 },
};

function contactsNamed(...names: string[]): SearchResults["contacts"]["items"] {
  return names.map((name, i) => ({ id: i + 1, name, organization_name: null }));
}

type Request = { q: string; reply: (body: SearchResults, status?: number) => void };

/** Stubs fetch so each search waits for the test to reply, unless `answers` has its text. */
function stubSearch(answers: Record<string, SearchResults> = {}) {
  const requests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string) =>
        new Promise((resolve) => {
          const q = new URL(url, "http://localhost").searchParams.get("q") ?? "";
          const reply = (body: SearchResults, status = 200) =>
            resolve({ ok: status < 400, status, json: async () => body });
          requests.push({ q, reply });
          if (answers[q]) reply(answers[q]);
        }),
    ),
  );
  return requests;
}

function Where() {
  return (
    <>
      <p>At {useLocation().pathname}</p>
      <Link to="/pipeline">Pipeline</Link>
    </>
  );
}

function renderBox() {
  renderSignedIn(
    <>
      <SearchBox />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </>,
  );
  return screen.getByRole("combobox", { name: "Search" });
}

/** Runs `step`, then the timers it sets off, such as TanStack Query's zero-delay updates. */
const settle = (step: () => unknown = () => {}) =>
  act(async () => {
    step();
    await vi.advanceTimersByTimeAsync(0);
  });

/** Waits out the pause, then lets the request it sends, and any reply ready for it, land. */
async function pause() {
  await settle(() => vi.advanceTimersByTime(PAUSE_MS));
  await settle();
}

/** Replies to a waiting request and lets the screen catch up. */
const answer = (request: Request, body: SearchResults, status?: number) =>
  settle(() => request.reply(body, status));

async function typeAndPause(box: HTMLElement, text: string) {
  fireEvent.change(box, { target: { value: text } });
  await pause();
}

function optionNames() {
  return screen
    .queryAllByRole("option")
    .map((o) => o.querySelector(".top-search-name")?.textContent);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("the box is a combobox with the spec's placeholder", () => {
  stubSearch();
  const box = renderBox();
  expect(box).toHaveAttribute("placeholder", "Search organizations, contacts and deals");
  expect(box).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("search")).toContainElement(box);
});

test("results come in their groups, in order, with second lines and the match in bold", async () => {
  stubSearch({ gArCiA: GARCIA });
  const box = renderBox();
  await typeAndPause(box, "gArCiA");

  const listbox = screen.getByRole("listbox", { name: "Search results" });
  expect(box).toHaveAttribute("aria-expanded", "true");
  expect(box).toHaveAttribute("aria-controls", listbox.id);
  const groups = within(listbox).getAllByRole("group");
  expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual([
    "Organizations",
    "Contacts",
    "Deals",
  ]);
  expect(
    within(groups[2])
      .getAllByRole("option")
      .map((o) => o.textContent),
  ).toEqual(["Garcia data migrationGarcia Freight · Proposal", "Garcia hardware refreshWon"]);
  const organization = within(groups[0]).getByRole("option");
  expect(organization).toHaveTextContent("Garcia FreightLogistics");
  expect(organization.querySelector("strong")).toHaveTextContent(/^Garcia$/);
  expect(within(screen.getByRole("search")).getByRole("status")).toHaveTextContent("4 results");
});

test("a group with more says how many, and empty groups are left out", async () => {
  const names = ["Ann Lee", "Bea Lee", "Cy Lee", "Di Lee", "Ed Lee"];
  stubSearch({ lee: { ...NOTHING, contacts: { items: contactsNamed(...names), total: 12 } } });
  const box = renderBox();
  await typeAndPause(box, "lee");

  expect(screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual([
    "Contacts",
  ]);
  expect(optionNames()).toEqual(names);
  expect(
    screen.getByText("7 more contacts. Type more of the name to narrow it down."),
  ).toBeVisible();
});

test("says when nothing matches", async () => {
  stubSearch({ xyz: NOTHING });
  const box = renderBox();
  await typeAndPause(box, "xyz");

  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(box).toHaveAttribute("aria-expanded", "false");
  const message = 'No organizations, contacts or deals match "xyz".';
  expect(screen.getByText(message, { selector: "p:not([role])" })).toBeVisible();
  expect(within(screen.getByRole("search")).getByRole("status")).toHaveTextContent(message);
});

test("sends one request per pause in typing, and none for blank text", async () => {
  const requests = stubSearch();
  const box = renderBox();
  await typeAndPause(box, "   ");
  for (const text of ["g", "ga", "gar"]) {
    fireEvent.change(box, { target: { value: text } });
    await settle(() => vi.advanceTimersByTime(PAUSE_MS - 50));
  }
  expect(requests).toEqual([]);

  await pause();
  expect(requests.map((r) => r.q)).toEqual(["gar"]);

  // Spaces at either end don't make it new text.
  await typeAndPause(box, " gar ");
  expect(requests.map((r) => r.q)).toEqual(["gar"]);
});

test("keeps the last results until newer ones arrive, and an older reply never replaces them", async () => {
  const requests = stubSearch();
  const box = renderBox();
  await typeAndPause(box, "le");
  await answer(requests[0], {
    ...NOTHING,
    contacts: { items: contactsNamed("Ann Lee", "Lena Ross"), total: 2 },
  });
  expect(optionNames()).toEqual(["Ann Lee", "Lena Ross"]);

  await typeAndPause(box, "len");
  await typeAndPause(box, "lena");
  expect(requests.map((r) => r.q)).toEqual(["le", "len", "lena"]);
  expect(optionNames()).toEqual(["Ann Lee", "Lena Ross"]);

  await answer(requests[2], {
    ...NOTHING,
    contacts: { items: contactsNamed("Lena Ross"), total: 1 },
  });
  expect(optionNames()).toEqual(["Lena Ross"]);

  await answer(requests[1], {
    ...NOTHING,
    contacts: { items: contactsNamed("Glen Park", "Lena Ross"), total: 2 },
  });
  expect(optionNames()).toEqual(["Lena Ross"]);
});

test("clearing the box hides the results at once", async () => {
  stubSearch({ garcia: GARCIA });
  const box = renderBox();
  await typeAndPause(box, "garcia");
  expect(screen.getByRole("listbox")).toBeInTheDocument();

  fireEvent.change(box, { target: { value: "" } });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("text typed after clearing the box never shows the cleared text's results", async () => {
  const requests = stubSearch({ garcia: GARCIA });
  const box = renderBox();
  await typeAndPause(box, "garcia");
  expect(optionNames()).toContain("Garcia Freight");

  fireEvent.change(box, { target: { value: "" } });
  fireEvent.change(box, { target: { value: "heath" } });
  await settle(() => vi.advanceTimersByTime(PAUSE_MS - 50));
  expect(optionNames()).toEqual([]);

  await pause();
  expect(requests.map((r) => r.q)).toEqual(["garcia", "heath"]);
  expect(optionNames()).toEqual([]);

  await answer(requests[1], {
    ...NOTHING,
    organizations: { items: [{ id: 5, name: "Heath Labs", industry: null }], total: 1 },
  });
  expect(optionNames()).toEqual(["Heath Labs"]);
});

test("going to another page clears the box and closes the results", async () => {
  stubSearch({ garcia: GARCIA });
  const box = renderBox();
  await typeAndPause(box, "garcia");
  expect(screen.getByRole("listbox")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("link", { name: "Pipeline" }));
  expect(screen.getByText("At /pipeline")).toBeInTheDocument();
  expect(box).toHaveValue("");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.focus(box);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("the arrow keys move through the results, and Enter opens one and clears the box", async () => {
  stubSearch({ garcia: GARCIA });
  const box = renderBox();
  await typeAndPause(box, "garcia");
  const highlighted = () => screen.getByRole("option", { selected: true });

  fireEvent.keyDown(box, { key: "ArrowDown" });
  expect(highlighted()).toHaveTextContent("Garcia Freight");
  expect(box).toHaveAttribute("aria-activedescendant", highlighted().id);
  fireEvent.keyDown(box, { key: "ArrowDown" });
  expect(highlighted()).toHaveTextContent("Sabrina Garcia");
  fireEvent.keyDown(box, { key: "ArrowUp" });
  fireEvent.keyDown(box, { key: "ArrowUp" });
  expect(highlighted()).toHaveTextContent("Garcia hardware refresh");

  fireEvent.keyDown(box, { key: "Enter" });
  expect(screen.getByText("At /deals/13")).toBeInTheDocument();
  expect(box).toHaveValue("");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("Enter with nothing highlighted stays put", async () => {
  stubSearch({ garcia: GARCIA });
  const box = renderBox();
  await typeAndPause(box, "garcia");
  fireEvent.keyDown(box, { key: "Enter" });
  expect(screen.getByText("At /")).toBeInTheDocument();
  expect(box).toHaveValue("garcia");
});

test("Escape closes the results, and the down arrow opens them again", async () => {
  stubSearch({ garcia: GARCIA });
  const box = renderBox();
  await typeAndPause(box, "garcia");

  fireEvent.keyDown(box, { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(box).toHaveValue("garcia");

  fireEvent.keyDown(box, { key: "ArrowDown" });
  expect(screen.getByRole("listbox")).toBeInTheDocument();
});

test("clicking a result opens it and clears the box", async () => {
  stubSearch({ garcia: GARCIA });
  const box = renderBox();
  await typeAndPause(box, "garcia");

  fireEvent.click(screen.getByRole("option", { name: /Sabrina Garcia/ }));
  expect(screen.getByText("At /contacts/8")).toBeInTheDocument();
  expect(box).toHaveValue("");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("leaving the box closes the results", async () => {
  stubSearch({ garcia: GARCIA });
  const box = renderBox();
  await typeAndPause(box, "garcia");
  fireEvent.blur(box);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.focus(box);
  expect(screen.getByRole("listbox")).toBeInTheDocument();
});

test("says plainly when the search fails", async () => {
  const requests = stubSearch();
  const box = renderBox();
  await typeAndPause(box, "garcia");
  await answer(requests[0], NOTHING, 500);
  expect(screen.getByText(/^Couldn't search\./)).toBeVisible();
});
