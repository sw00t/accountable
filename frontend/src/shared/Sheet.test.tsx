// TF37 (N6, R7): a sheet is a labelled modal dialog that takes focus, gives it back, and closes
// on Escape, a tap outside or its handle dragged down, with the page held still while it's open.
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Sheet } from "./Sheet";

function Opener({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Sheet
        title="Sort by"
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <button>Name, A to Z</button>
      </Sheet>
    </>
  );
}

async function openSheet() {
  await userEvent.click(screen.getByRole("button", { name: "Open" }));
  return screen.getByRole("dialog", { name: "Sort by" });
}

test("it's a labelled modal dialog with its title as a heading, and takes focus", async () => {
  render(<Opener />);
  const sheet = await openSheet();
  expect(sheet).toHaveAttribute("aria-modal", "true");
  expect(screen.getByRole("heading", { name: "Sort by" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Name, A to Z" })).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
});

test("Escape closes it, gives focus back and lets the page scroll again", async () => {
  const onClose = vi.fn();
  render(<Opener onClose={onClose} />);
  await openSheet();
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
});

test("a tap outside closes it, and a tap inside doesn't", async () => {
  render(<Opener />);
  const sheet = await openSheet();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Name, A to Z" }));
  expect(sheet).toBeInTheDocument();
  fireEvent.pointerDown(sheet.parentElement!);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

function drag(handle: Element, down: number) {
  // jsdom's PointerEvent leaves out clientY, so it's set on the event by hand.
  for (const [type, y] of [
    ["pointerDown", 100],
    ["pointerUp", 100 + down],
  ] as const) {
    const event = createEvent[type](handle, { pointerId: 1 });
    Object.defineProperty(event, "clientY", { value: y });
    fireEvent(handle, event);
  }
}

test("dragging the handle down far enough closes it; a short drag doesn't", async () => {
  render(<Opener />);
  const sheet = await openSheet();
  const handle = sheet.querySelector(".sheet-handle")!;
  drag(handle, 20);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  drag(handle, 80);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("a re-render of its owner leaves focus where the person put it", async () => {
  // A new onClose on each render, as an inline arrow function gives.
  const sheet = (count: number) => (
    <Sheet title="Sort by" open onClose={() => count}>
      <button type="button">First</button>
      <button type="button">Second</button>
    </Sheet>
  );
  const { rerender } = render(sheet(1));
  expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  screen.getByRole("button", { name: "Second" }).focus();
  rerender(sheet(2));
  expect(screen.getByRole("button", { name: "Second" })).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
});
