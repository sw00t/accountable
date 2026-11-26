// TF38 (T8, N5): on a phone the table's rows are a list, with More, Sort by and paging.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { setPhone } from "../test-setup";
import { DataTable } from "./DataTable";
import { TopBarSlot } from "./topBarSlot";

type Row = { id: number; name: string; city: string; value: number };

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Name", enableGlobalFilter: true },
  { accessorKey: "city", header: "City", enableGlobalFilter: true },
  { accessorKey: "value", header: "Value", meta: { numeric: true } },
];

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Org ${String(i + 1).padStart(2, "0")}`,
    city: i % 2 ? "Leeds" : "York",
    value: (i * 37) % 100,
  }));
}

const phoneRow = (r: Row) => ({ name: r.name, detail: r.city, end: `$${r.value}` });

function setup(data: Row[], withPhoneRow = true) {
  const handlers = { onOpen: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onAdd: vi.fn() };
  render(
    <DataTable<Row>
      data={data}
      columns={columns}
      noun={["organization", "organizations"]}
      rowName={(r) => r.name}
      addLabel="Add organization"
      initialSort={[{ id: "name", desc: false }]}
      phoneRow={withPhoneRow ? phoneRow : undefined}
      {...handlers}
    />,
  );
  return handlers;
}

const listNames = () =>
  screen.getAllByRole("listitem").map((item) => item.querySelector(".phone-row-name")!.textContent);
const search = () => screen.getByRole("searchbox", { name: "Search organizations" });

beforeEach(() => setPhone(true));

test("rows are a list with the name, second line and end; tapping one opens it", async () => {
  const { onOpen } = setup(rows(3));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  const first = screen.getAllByRole("listitem")[0];
  expect(first).toHaveTextContent("Org 01 York$0");
  await userEvent.click(within(first).getByRole("button", { name: "Org 01 York" }));
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ name: "Org 01" }));
});

test("More opens Edit and Delete for the row", async () => {
  const { onEdit, onDelete } = setup(rows(2));
  await userEvent.click(screen.getByRole("button", { name: "More for Org 02" }));
  const sheet = screen.getByRole("dialog", { name: "Org 02" });
  await userEvent.click(within(sheet).getByRole("button", { name: "Edit" }));
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ name: "Org 02" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "More for Org 01" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ name: "Org 01" }));
});

test("Sort by lists every sortable column in both orders, sorts, and marks the current one", async () => {
  setup(rows(4));
  await userEvent.click(screen.getByRole("button", { name: "Sort by" }));
  const sheet = screen.getByRole("dialog", { name: "Sort by" });
  expect(
    within(sheet)
      .getAllByRole("button")
      .map((c) => c.textContent),
  ).toEqual([
    "Name, A to Z",
    "Name, Z to A",
    "City, A to Z",
    "City, Z to A",
    "Value, lowest first",
    "Value, highest first",
  ]);
  expect(within(sheet).getByRole("button", { name: "Name, A to Z" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await userEvent.click(within(sheet).getByRole("button", { name: "Name, Z to A" }));
  expect(listNames()).toEqual(["Org 04", "Org 03", "Org 02", "Org 01"]);
  await userEvent.click(screen.getByRole("button", { name: "Sort by" }));
  expect(screen.getByRole("button", { name: "Name, Z to A" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("search and paging work as on a laptop, as 26 to 50 of 60", async () => {
  setup(rows(60));
  expect(screen.getByText("1 to 25 of 60")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("26 to 50 of 60")).toBeInTheDocument();
  expect(listNames()[0]).toBe("Org 26");

  await userEvent.type(search(), "leeds");
  expect(screen.getByText("1 to 25 of 30")).toBeInTheDocument();
});

test("turning into a laptop and back keeps the search and page (N5)", async () => {
  setup(rows(60));
  await userEvent.type(search(), "o");
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  setPhone(false);
  expect(search()).toHaveValue("o");
  expect(screen.getByText("Showing 26 to 50 of 60")).toBeInTheDocument();
  setPhone(true);
  expect(screen.getByText("26 to 50 of 60")).toBeInTheDocument();
});

test("without a phone row, the table stays a table", () => {
  setup(rows(2), false);
  expect(screen.getByRole("table")).toBeInTheDocument();
});

test("in landscape the filters move into the top bar; in portrait they stay above the list", () => {
  const slot = document.createElement("div");
  document.body.append(slot);
  const filters = <div role="group" aria-label="Filter by city" />;
  const table = (
    <TopBarSlot.Provider value={slot}>
      <DataTable<Row>
        data={rows(2)}
        columns={columns}
        noun={["organization", "organizations"]}
        rowName={(r) => r.name}
        initialSort={[{ id: "name", desc: false }]}
        phoneRow={phoneRow}
        filters={filters}
        addLabel="Add organization"
        onOpen={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAdd={vi.fn()}
      />
    </TopBarSlot.Provider>
  );
  const { rerender } = render(table);
  const group = () => screen.getByRole("group", { name: "Filter by city" });
  expect(slot).not.toContainElement(group());
  setPhone("landscape");
  rerender(table);
  expect(slot).toContainElement(group());
  setPhone(true);
  expect(slot).not.toContainElement(group());
  slot.remove();
});
