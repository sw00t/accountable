// TF41 (A7, Concern 26): on a phone the timeline has no inline form, and each activity's
// Edit and Delete are behind its More button.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setPhone } from "../test-setup";
import { mockApi, renderWithProviders, timelineEntry } from "../shared/test-utils";
import { Timeline } from "./Timeline";

afterEach(() => vi.unstubAllGlobals());

const call = timelineEntry({});
const move = timelineEntry({
  kind: "stage_change",
  id: 3,
  text: "Moved from New to Proposal",
  type: null,
  from_stage: "new",
  to_stage: "proposal",
  added_by: null,
});

function show(items = [call, move]) {
  mockApi({ "GET /contacts/7/timeline": { items } });
  setPhone(true);
  renderWithProviders(<Timeline kind="contact" id={7} />);
}

test("there's no inline Log activity form on a phone", async () => {
  show();
  await screen.findByRole("list");
  expect(screen.queryByRole("form", { name: "Log activity" })).not.toBeInTheDocument();
});

test("an activity's More opens Edit and Delete; a stage change has none", async () => {
  show();
  const [activity, stageChange] = within(await screen.findByRole("list")).getAllByRole("listitem");
  expect(within(stageChange).queryByRole("button", { name: /^More for/ })).not.toBeInTheDocument();
  expect(within(activity).queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();

  await userEvent.click(within(activity).getByRole("button", { name: /^More for call/ }));
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByRole("dialog", { name: "Edit activity" })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");

  await userEvent.click(within(activity).getByRole("button", { name: /^More for call/ }));
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(screen.getByRole("alertdialog", { name: "Delete this activity?" })).toBeInTheDocument();
});

test("an empty timeline points to Log activity", async () => {
  show([]);
  expect(
    await screen.findByText("Nothing logged yet. Use Log activity to log a call, email or note."),
  ).toBeInTheDocument();
});
