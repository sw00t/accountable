// U9, U10, G10: who added a record and who last changed it, with dates.
import { render, screen } from "@testing-library/react";
import { Authorship } from "./Authorship";

const record = {
  added_by: "Jane Smith",
  created_at: "2026-11-03T09:15:00",
  changed_by: "Sam Lee",
  updated_at: "2026-11-16T17:40:00",
};

test("shows who added the record and who last changed it, with the dates", () => {
  render(<Authorship record={record} />);
  expect(screen.getByText("Added by Jane Smith on 3 Nov 2026")).toBeInTheDocument();
  expect(screen.getByText("Last changed by Sam Lee on 16 Nov 2026")).toBeInTheDocument();
});

test("a sample record shows Sample data", () => {
  render(<Authorship record={{ ...record, added_by: "Sample data", changed_by: "Sample data" }} />);
  expect(screen.getByText("Added by Sample data on 3 Nov 2026")).toBeInTheDocument();
  expect(screen.getByText("Last changed by Sample data on 16 Nov 2026")).toBeInTheDocument();
});
