// The phone's version of a table (T8): rows as a list with a More menu, Sort by, and paging.
import { useState, type ReactNode } from "react";
import type { Column, Row, Table } from "@tanstack/react-table";
import { ArrowDownUp, Check } from "lucide-react";
import { MoreMenu } from "./MoreMenu";
import { Sheet } from "./Sheet";

/** What a phone shows for a row: its name, a second line, and a status, stage or amount. */
export type PhoneRow = { name: string; badge?: ReactNode; detail?: ReactNode; end?: ReactNode };

type ListProps<T> = {
  rows: Row<T>[];
  phoneRow: (row: T) => PhoneRow;
  onOpen: (row: T) => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
};

export function PhoneList<T>({ rows, phoneRow, onOpen, onEdit, onDelete }: ListProps<T>) {
  return (
    <ul className="phone-list">
      {rows.map((row) => {
        const { name, badge, detail, end } = phoneRow(row.original);
        return (
          <li key={row.id} className="phone-row">
            <button type="button" className="phone-row-open" onClick={() => onOpen(row.original)}>
              <span className="phone-row-name">
                {name}
                {badge}
              </span>
              {/* The space keeps the two lines apart for screen readers; the column hides it. */}
              {detail && (
                <>
                  {" "}
                  <span className="phone-row-detail">{detail}</span>
                </>
              )}
            </button>
            {end && <span className="phone-row-end">{end}</span>}
            <MoreMenu
              title={name}
              actions={[
                { label: "Edit", onSelect: () => onEdit(row.original) },
                { label: "Delete", onSelect: () => onDelete(row.original), danger: true },
              ]}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** The words for each direction: "A to Z", unless the column says otherwise. */
function directions<T>(column: Column<T, unknown>): [string, string] {
  const meta = (column.columnDef.meta ?? {}) as { numeric?: boolean; sortWords?: [string, string] };
  if (meta.sortWords) return meta.sortWords;
  return meta.numeric ? ["lowest first", "highest first"] : ["A to Z", "Z to A"];
}

/** A "Sort by" button and its sheet: every sortable column, in either order (T8). */
export function SortBy<T>({ table }: { table: Table<T> }) {
  const [open, setOpen] = useState(false);
  const columns = table.getAllLeafColumns().filter((column) => column.getCanSort());
  const choices = columns.flatMap((column) => {
    const header = column.columnDef.header;
    const label = typeof header === "string" ? header : column.id;
    const [up, down] = directions(column);
    return [
      { column, desc: false, label: `${label}, ${up}` },
      { column, desc: true, label: `${label}, ${down}` },
    ];
  });
  return (
    <>
      <button
        type="button"
        className="icon-btn sort-by"
        aria-label="Sort by"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <ArrowDownUp size={18} aria-hidden="true" />
      </button>
      <Sheet title="Sort by" open={open} onClose={() => setOpen(false)}>
        <div className="sheet-actions">
          {choices.map(({ column, desc, label }) => {
            const chosen = column.getIsSorted() === (desc ? "desc" : "asc");
            return (
              <button
                key={label}
                type="button"
                aria-pressed={chosen}
                className="sheet-action"
                onClick={() => {
                  table.setSorting([{ id: column.id, desc }]);
                  setOpen(false);
                }}
              >
                {label}
                {chosen && <Check size={18} aria-hidden="true" className="sheet-tick" />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

type PagerProps = { first: number; last: number; total: number; table: Table<unknown> };

/** "26 to 50 of 412" between Previous and Next (T3, T8). */
export function PhonePager({ first, last, total, table }: PagerProps) {
  return (
    <div className="phone-pager">
      <button
        type="button"
        className="btn ghost"
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      >
        Previous
      </button>
      <span className="muted">
        {first} to {last} of {total}
      </span>
      <button
        type="button"
        className="btn ghost"
        disabled={!table.getCanNextPage()}
        onClick={() => table.nextPage()}
      >
        Next
      </button>
    </div>
  );
}
