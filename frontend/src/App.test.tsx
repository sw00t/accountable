// The app's frame: the sidebar takes you to each section, and a bad link says so.
// TF22: a refused session reaches the session gate once, with no toasts.
// TF33: every page has the top bar with the search box and the user menu, and the
// sidebar has no theme switch.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { list, mockApi, organizationRow, renderApp } from "./shared/test-utils";

afterEach(() => vi.unstubAllGlobals());

test("the sidebar names the app and marks the section you're in", async () => {
  mockApi({ "GET /organizations": list([organizationRow()]) });
  renderApp("/organizations");
  const nav = screen.getByRole("navigation", { name: "Sections" });
  expect(screen.getByText("Accountable")).toBeInTheDocument();
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Dashboard", "Pipeline", "Deals", "Contacts", "Organizations"]);
  expect(within(nav).getByRole("link", { name: "Organizations" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  expect(await screen.findByRole("heading", { name: "Organizations" })).toBeInTheDocument();
});

test("a sidebar link opens its section", async () => {
  mockApi({
    "GET /organizations": list([organizationRow()]),
    "GET /deals": list([]),
  });
  renderApp("/organizations");
  await userEvent.click(screen.getByRole("link", { name: "Deals" }));
  expect(await screen.findByRole("heading", { name: "Deals" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Deals" })).toHaveAttribute("aria-current", "page");
});

test("a link to nowhere says so and offers the way back", () => {
  mockApi({});
  renderApp("/no-such-page");
  expect(screen.getByRole("heading", { name: "We couldn't find that page" })).toBeInTheDocument();
  expect(
    screen.getByText(/It may have been deleted, or the link may be wrong/),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Go to the dashboard" })).toHaveAttribute("href", "/");
});

test("a refused session tells the gate once and raises no toast", async () => {
  const refused = () => ({
    status: 401,
    body: { message: "Sign in to use Accountable.", fields: {} },
  });
  mockApi({ "GET /dashboard": refused, "GET /organizations": refused });
  const { ended } = renderApp("/");
  await vi.waitFor(() => expect(ended).toHaveBeenCalledTimes(1));
  await userEvent.click(screen.getByRole("link", { name: "Organizations" }));
  expect(await screen.findByRole("heading", { name: "Organizations" })).toBeInTheDocument();
  expect(ended).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Sign in to use Accountable|Couldn't/)).not.toBeInTheDocument();
});

/** The page's banner. Testing Library counts every header, but a browser skips one inside `main`. */
const topBar = () => screen.getAllByRole("banner").find((banner) => !banner.closest("main"))!;

test.each([
  "/",
  "/pipeline",
  "/deals",
  "/deals/5",
  "/contacts",
  "/contacts/7",
  "/organizations",
  "/organizations/2",
  "/no-such-page",
])("%s has the top bar with the search box and the user menu", (path) => {
  mockApi({});
  renderApp(path);
  expect(within(topBar()).getByRole("combobox", { name: "Search" })).toHaveAttribute(
    "placeholder",
    "Search organizations, contacts and deals",
  );
  expect(
    within(topBar()).getByRole("button", { name: "Account menu for Test User" }),
  ).toHaveTextContent("TU");
});

test("the sidebar holds only the section links, with the theme in the user menu", () => {
  mockApi({});
  renderApp("/");
  const sidebar = screen.getByRole("complementary");
  expect(within(sidebar).queryByRole("switch")).not.toBeInTheDocument();
  expect(within(sidebar).queryByRole("button")).not.toBeInTheDocument();
  expect(within(sidebar).queryByText(/dark mode/i)).not.toBeInTheDocument();
});
