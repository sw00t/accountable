// TF40, TF41 (spec Record pages, C7, A7): a record's header on a phone and on a laptop.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogActivityForm } from "../activities/LogActivityForm";
import { setPhone } from "../test-setup";
import { RecordHeader } from "./RecordHeader";
import { renderWithProviders } from "./test-utils";

function setup(extra: Partial<Parameters<typeof RecordHeader>[0]> = {}) {
  const handlers = { onEdit: vi.fn(), onDelete: vi.fn() };
  renderWithProviders(
    <RecordHeader
      name="Karen Willis"
      noun="contact"
      detail="Chief Operating Officer at Wilson Software"
      status={<span>Customer</span>}
      back="/contacts"
      {...handlers}
      {...extra}
    />,
  );
  return handlers;
}

describe("on a phone", () => {
  beforeEach(() => setPhone(true));

  test("shows the name, second line and status, with Edit and Delete under More", async () => {
    const { onEdit, onDelete } = setup();
    expect(screen.getByRole("heading", { level: 1, name: "Karen Willis" })).toBeInTheDocument();
    expect(screen.getByText("Chief Operating Officer at Wilson Software")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete contact/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "More for Karen Willis" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "More for Karen Willis" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  test("Call and Email open the phone's dialer and mail app, and are left out when empty (C7)", () => {
    setup({ call: "0113 496 0000", email: "karen@wilson.example" });
    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:0113 496 0000");
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      "mailto:karen@wilson.example",
    );
  });

  test("with no number or address there's no Call or Email", () => {
    setup({ call: null, email: null });
    expect(screen.queryByRole("link", { name: "Call" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Email" })).not.toBeInTheDocument();
  });

  test("Log activity opens the form in a sheet with Call chosen and What happened focused (A7)", async () => {
    setup({
      log: (done) => <LogActivityForm on={{ contactId: 7 }} onSaved={done} onCancel={done} />,
    });
    await userEvent.click(screen.getByRole("button", { name: "Log activity" }));
    const panel = screen.getByRole("dialog", { name: "Log activity" });
    expect(within(panel).getByRole("radio", { name: "Call" })).toBeChecked();
    expect(within(panel).getByLabelText(/What happened/)).toHaveFocus();
    await userEvent.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

test("on a laptop it's the page header as before, with Delete", async () => {
  const { onDelete } = setup();
  expect(screen.getByRole("heading", { level: 1, name: "Karen Willis" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Delete contact" }));
  expect(onDelete).toHaveBeenCalledOnce();
});
