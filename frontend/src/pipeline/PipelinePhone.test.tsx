// TF43 (P9 to P11): on a phone the board is one stage at a time, with Move to, Move up and
// Move down sent through the same save path as a drop.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import type { DealRow } from "../deals/hooks";
import { setPhone } from "../test-setup";
import { dealRow, list, mockApi, renderWithProviders } from "../shared/test-utils";
import { applyMove } from "./board";
import { PipelinePage } from "./PipelinePage";

afterEach(() => vi.unstubAllGlobals());

const deal = (id: number, name: string, stage: DealRow["stage"], position: number, value: number) =>
  dealRow({
    id,
    name,
    stage,
    position,
    value,
    probability: stage === "won" ? 100 : 10,
    expected_revenue: stage === "won" ? value : value / 10,
    is_late: false,
    organization_name: null,
    contact_name: null,
  });

const renewal = deal(1, "Fleet renewal", "new", 1, 10000);
const lorries = deal(2, "Lorry hire", "new", 2, 20000);
const vans = deal(3, "Van hire", "new", 3, 30000);
const parts = deal(4, "Spare parts", "won", 1, 2500);
const deals = [renewal, lorries, vans, parts];

function Where() {
  const { pathname, search } = useLocation();
  return <p>At {pathname + search}</p>;
}

function open(path = "/pipeline", extra = {}) {
  setPhone(true);
  const calls = mockApi({ "GET /deals": list(deals), ...extra });
  renderWithProviders(
    <Routes>
      <Route
        path="/pipeline"
        element={
          <>
            <PipelinePage />
            <Where />
          </>
        }
      />
    </Routes>,
    undefined,
    path,
  );
  return calls;
}

/** A server that keeps each move, as the real one does, so the reload after a save shows it. */
function server() {
  let current = deals;
  const routes: Record<string, unknown> = { "GET /deals": () => ({ body: list(current) }) };
  for (const { id } of deals) {
    routes[`POST /deals/${id}/move`] = (body: {
      stage: DealRow["stage"];
      after_id: number | null;
      before_id: number | null;
    }) => {
      current = applyMove(
        current,
        { id, stage: body.stage, afterId: body.after_id, beforeId: body.before_id },
        "2026-11-25",
      );
      return { body: current.find((d) => d.id === id) };
    };
  }
  return routes;
}

const panel = () => screen.findByRole("tabpanel");
const shown = async () =>
  within(await panel())
    .getAllByRole("link")
    .map((link) => link.querySelector(".t")!.textContent);
const moveTo = async (name: string) =>
  userEvent.click(await screen.findByRole("button", { name: `Move to: ${name}` }));
const sheet = (name: string) => screen.getByRole("dialog", { name: `Move "${name}" to` });
const posts = (calls: { method: string; path: string; body: unknown }[]) =>
  calls.filter((c) => c.method === "POST");

test("one stage at a time, chosen from the tabs, each with its count", async () => {
  open();
  expect(await shown()).toEqual(["Fleet renewal", "Lorry hire", "Van hire"]);
  const tabs = screen.getAllByRole("tab");
  expect(tabs.map((t) => t.textContent)).toEqual([
    "New3",
    "Qualified0",
    "Proposal0",
    "Negotiation0",
    "Won1",
    "Lost0",
  ]);
  expect(screen.getByRole("tab", { name: "New, 3 deals" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByTestId("column-value")).toHaveTextContent("$60,000");
  // P9: the board's open totals sit under the title.
  expect(screen.getByTestId("board-value")).toHaveTextContent("$60,000");

  await userEvent.click(screen.getByRole("tab", { name: /^Won/ }));
  expect(await shown()).toEqual(["Spare parts"]);
  expect(screen.getByTestId("column-value")).toHaveTextContent("$2,500");
  expect(screen.getByText("At /pipeline?stage=won")).toBeInTheDocument();
});

test("the stage comes from the address, so a reload or Back returns to it", async () => {
  open("/pipeline?stage=won");
  expect(await shown()).toEqual(["Spare parts"]);
  expect(screen.getByRole("tab", { name: /^Won/ })).toHaveAttribute("aria-selected", "true");
});

test("the arrow keys move between the tabs", async () => {
  open();
  await panel();
  screen.getByRole("tab", { name: /^New/ }).focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: /^Qualified/ })).toHaveFocus();
  expect(screen.getByText("At /pipeline?stage=qualified")).toBeInTheDocument();
  await userEvent.keyboard("{End}");
  expect(screen.getByRole("tab", { name: /^Lost/ })).toHaveAttribute("aria-selected", "true");
});

test("cards can't be dragged; each opens its deal and has Move to", async () => {
  open();
  const card = within(await panel()).getByRole("link", { name: "Fleet renewal, $10,000" });
  expect(card).toHaveAttribute("href", "/deals/1");
  expect(screen.queryByRole("button", { name: /Fleet renewal, \$/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^Move to: / })).toHaveLength(3);
});

test("Move to lists the six stages with the current one marked (now)", async () => {
  open();
  await moveTo("Lorry hire");
  const choices = within(sheet("Lorry hire")).getAllByRole("button");
  expect(choices.map((c) => c.textContent)).toEqual([
    "New (now)",
    "Qualified",
    "Proposal",
    "Negotiation",
    "Won",
    "Lost",
    "Move up",
    "Move down",
  ]);
  expect(choices[0]).toBeDisabled();
  expect(within(sheet("Lorry hire")).getByText("It goes to the top of that stage.")).toBeVisible();
});

test("Move up is left out for the first card and Move down for the last", async () => {
  open();
  await moveTo("Fleet renewal");
  expect(within(sheet("Fleet renewal")).queryByRole("button", { name: "Move up" })).toBeNull();
  expect(within(sheet("Fleet renewal")).getByRole("button", { name: "Move down" })).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await moveTo("Van hire");
  expect(within(sheet("Van hire")).getByRole("button", { name: "Move up" })).toBeVisible();
  expect(within(sheet("Van hire")).queryByRole("button", { name: "Move down" })).toBeNull();
});

test("a move to another stage changes the totals at once, says so and stays on the stage", async () => {
  const calls = open("/pipeline", server());
  await moveTo("Lorry hire");
  await userEvent.click(within(sheet("Lorry hire")).getByRole("button", { name: "Won" }));
  expect(screen.getByText("Moved Lorry hire to Won")).toBeInTheDocument();
  expect(await shown()).toEqual(["Fleet renewal", "Van hire"]);
  expect(screen.getByTestId("column-value")).toHaveTextContent("$40,000");
  expect(screen.getByRole("tab", { name: /^Won/ })).toHaveTextContent("Won2");
  expect(screen.getByText("At /pipeline")).toBeInTheDocument();
  expect(posts(calls)).toEqual([
    {
      method: "POST",
      path: "/deals/2/move",
      body: { stage: "won", after_id: null, before_id: 4 },
    },
  ]);
});

test("a failed move puts the card back and says why", async () => {
  open("/pipeline", {
    "POST /deals/2/move": () => ({ status: 409, body: { message: "That deal has changed." } }),
  });
  await moveTo("Lorry hire");
  await userEvent.click(within(sheet("Lorry hire")).getByRole("button", { name: "Won" }));
  expect(
    await screen.findByText("Couldn't move Lorry hire. That deal has changed."),
  ).toBeInTheDocument();
  await waitFor(async () => expect(await shown()).toContain("Lorry hire"));
});

test("Move up and Move down move the card one place and save it there", async () => {
  const calls = open("/pipeline", server());
  await moveTo("Lorry hire");
  await userEvent.click(within(sheet("Lorry hire")).getByRole("button", { name: "Move up" }));
  expect(await shown()).toEqual(["Lorry hire", "Fleet renewal", "Van hire"]);
  await moveTo("Fleet renewal");
  await userEvent.click(within(sheet("Fleet renewal")).getByRole("button", { name: "Move down" }));
  await waitFor(() => expect(posts(calls)).toHaveLength(2));
  await waitFor(async () =>
    expect(await shown()).toEqual(["Lorry hire", "Van hire", "Fleet renewal"]),
  );
  expect(posts(calls).map((c) => c.body)).toEqual([
    { stage: "new", after_id: null, before_id: 1 },
    { stage: "new", after_id: 3, before_id: null },
  ]);
});

test("with a search on, the tabs count and the sheet moves past the cards shown", async () => {
  const calls = open("/pipeline", server());
  await userEvent.type(await screen.findByRole("searchbox", { name: "Search deals" }), "renewal");
  expect(await shown()).toEqual(["Fleet renewal"]);
  expect(screen.getByRole("tab", { name: /^New/ })).toHaveTextContent("New1");
  await moveTo("Fleet renewal");
  expect(
    within(sheet("Fleet renewal")).queryByRole("button", { name: /Move (up|down)/ }),
  ).toBeNull();
  await userEvent.keyboard("{Escape}");
  await userEvent.clear(screen.getByRole("searchbox"));
  await userEvent.type(screen.getByRole("searchbox"), "hire");
  // Fleet renewal is hidden above the two cards shown.
  expect(await shown()).toEqual(["Lorry hire", "Van hire"]);
  await moveTo("Van hire");
  await userEvent.click(within(sheet("Van hire")).getByRole("button", { name: "Move up" }));
  await waitFor(() => expect(posts(calls)).toHaveLength(1));
  expect(posts(calls)[0].body).toEqual({ stage: "new", after_id: null, before_id: 1 });
});
