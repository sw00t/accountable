// TF30 (spec U4, U11, U12): the initials circle, its menu, keyboard use and signing out.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { renderWithProviders } from "../shared/test-utils";
import { THEME_KEY } from "../shared/theme/mode";
import { SESSION_KEY, SessionProvider, type Person } from "./session";
import { SessionGate } from "./SessionGate";
import { UserMenu } from "./UserMenu";

const JANE: Person = { name: "Jane Smith", email: "jane@example.com" };

function renderMenu(person = JANE) {
  const signOut = vi.fn(async () => {});
  render(
    <div>
      <SessionProvider value={{ person, signOut }}>
        <UserMenu />
      </SessionProvider>
      <p>Elsewhere on the page</p>
      <input aria-label="Search" />
    </div>,
  );
  return { signOut, user: userEvent.setup() };
}

const circle = () => screen.getByRole("button", { name: "Account menu for Jane Smith" });
const items = () => [
  ...screen.getAllByRole("menuitemradio"),
  screen.getByRole("menuitem", { name: "Sign out" }),
];

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("UserMenu", () => {
  it("is a circle with the initials, named for screen readers", () => {
    renderMenu();
    expect(circle()).toHaveTextContent("JS");
    expect(circle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("names the circle by email when there's no display name", () => {
    renderMenu({ name: null, email: "sam@example.com" });
    expect(
      screen.getByRole("button", { name: "Account menu for sam@example.com" }),
    ).toHaveTextContent("S");
  });

  it("opens with a click to the name, the email, the theme choice and Sign out", async () => {
    const { user } = renderMenu();

    await user.click(circle());

    expect(screen.getByRole("menu", { name: "Account menu for Jane Smith" })).toBeVisible();
    expect(screen.getByText("Jane Smith")).toBeVisible();
    expect(screen.getByText("jane@example.com")).toBeVisible();
    expect(screen.getByRole("group", { name: "Theme" })).toBeVisible();
    expect(items().map((item) => item.textContent)).toEqual([
      "Light",
      "Dark",
      "System",
      "Sign out",
    ]);
    expect(items()[0]).toHaveFocus();
  });

  it.each([["{Enter}"], [" "]])("opens with %s, and the arrows move through it", async (key) => {
    const { user } = renderMenu();
    circle().focus();

    await user.keyboard(key);
    expect(items()[0]).toHaveFocus();

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(items()[3]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items()[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(items()[3]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(items()[0]).toHaveFocus();
  });

  it("picks a theme from the keyboard and stays open", async () => {
    const { user } = renderMenu();
    await user.click(circle());

    await user.keyboard("{Enter}");

    expect(screen.getByRole("menuitemradio", { name: "Light" })).toBeChecked();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(screen.getByRole("menu")).toBeVisible();
  });

  it("closes with Escape and puts focus back on the circle", async () => {
    const { user } = renderMenu();
    await user.click(circle());

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(circle()).toHaveFocus();
  });

  it("closes with a click outside and puts focus back on the circle", async () => {
    const { user } = renderMenu();
    await user.click(circle());

    await user.click(screen.getByText("Elsewhere on the page"));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(circle()).toHaveFocus();
  });

  it("leaves focus in a field clicked into while it's open", async () => {
    const { user } = renderMenu();
    await user.click(circle());

    await user.click(screen.getByRole("textbox", { name: "Search" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
  });

  it("signs out to the sign-in screen, forgetting the data and keeping the theme", async () => {
    localStorage.setItem(THEME_KEY, "light");
    localStorage.setItem(SESSION_KEY, JSON.stringify(storedSession()));
    stubLocalSignIn();
    const { client } = renderWithProviders(
      <SessionGate>
        <UserMenu />
        <CachedData />
      </SessionGate>,
    );
    const user = userEvent.setup();
    await screen.findByText("Cached");

    await user.click(screen.getByRole("button", { name: "Account menu for Jane Smith" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });
});

/** Something the app has cached, which signing out must forget. */
function CachedData() {
  const { data } = useQuery({ queryKey: ["cached"], queryFn: async () => "Cached" });
  return <p>{data}</p>;
}

function storedSession() {
  return {
    access_token: "token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "refresh",
    user: { id: "u1", email: JANE.email, user_metadata: { display_name: JANE.name } },
  };
}

/** Local sign-in: `/config` says local, and signing out is accepted. */
function stubLocalSignIn() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === "/api/config"
        ? Response.json({ sign_in: "local", supabase_url: null, supabase_publishable_key: null })
        : new Response(null, { status: 204 }),
    ),
  );
}
