import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { api } from "../shared/api";
import { renderWithProviders } from "../shared/test-utils";
import { openAccount, SESSION_KEY, useSession } from "./session";
import { SessionGate } from "./SessionGate";

const LOCAL = { sign_in: "local", supabase_url: null, supabase_publishable_key: null };
const USER = {
  id: "local-test-user",
  email: "test@accountable.local",
  user_metadata: { display_name: "Test User" },
};

function session(token: string, user = USER) {
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `refresh-${token}`,
    user,
  };
}

const renamed = (name: string) => ({ ...USER, user_metadata: { display_name: name } });

function json(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
  });
}

type Route = (request: { token: string | null }) => Response;

/** Stubs the backend: `/config` says local, each sign-in gives the next token, `routes` the rest. */
function stubBackend(routes: Record<string, Route> = {}) {
  let signIns = 0;
  const requests: { path: string; token: string | null }[] = [];
  const answer: Record<string, Route> = {
    "GET /api/config": () => json(200, LOCAL),
    "POST /api/local-auth/token": () => json(200, session(`token-${++signIns}`)),
    "POST /api/local-auth/logout": () => json(204),
    ...routes,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = new URL(url, window.location.origin).pathname;
      const headers = (init.headers ?? {}) as Record<string, string>;
      const token = headers.Authorization?.replace("Bearer ", "") ?? null;
      requests.push({ path, token });
      const route = answer[`${init.method ?? "GET"} ${path}`];
      return route ? route({ token }) : json(404, { message: "not stubbed" });
    }),
  );
  return requests;
}

/** A page that shows where it is and asks the API for something, as every page does. */
function Page() {
  const { pathname } = useLocation();
  const { person, signOut } = useSession();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<{ email: string }>("/me") });
  return (
    <div>
      <p>Page at {pathname}</p>
      <p>Signed in as {person.name}</p>
      {me.data && <p>API says {me.data.email}</p>}
      <button onClick={signOut}>Sign out</button>
    </div>
  );
}

function renderGate(path: string) {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <SessionGate>
        <Page />
      </SessionGate>,
      undefined,
      path,
    ),
  };
}

const meRoute: Route = ({ token }) =>
  token ? json(200, { email: "test@accountable.local" }) : json(401);

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("SessionGate", () => {
  it("shows the sign-in screen at any address, then opens that address once signed in", async () => {
    const requests = stubBackend({ "GET /api/me": meRoute });
    const { user } = renderGate("/deals/5");

    await user.click(await screen.findByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Page at /deals/5")).toBeVisible();
    expect(screen.getByText("Signed in as Test User")).toBeVisible();
    expect(await screen.findByText("API says test@accountable.local")).toBeVisible();
    expect(requests.find((request) => request.path === "/api/me")?.token).toBe("token-1");
  });

  it("keeps the person signed in across a reload", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session("kept")));
    const requests = stubBackend({ "GET /api/me": meRoute });
    renderGate("/contacts");

    expect(await screen.findByText("Page at /contacts")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    await screen.findByText("API says test@accountable.local");
    expect(requests.find((request) => request.path === "/api/me")?.token).toBe("kept");
  });

  it("says when the session has ended, forgets the data, and signing in returns to the same page", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session("refused")));
    stubBackend({
      "GET /api/me": ({ token }) =>
        token === "refused" ? json(401) : json(200, { email: "again@example.com" }),
    });
    const { user, client } = renderGate("/pipeline");

    expect(await screen.findByText("Your session has ended. Sign in again.")).toBeVisible();
    expect(screen.queryByText("Page at /pipeline")).not.toBeInTheDocument();
    expect(client.getQueryCache().getAll()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Page at /pipeline")).toBeVisible();
    expect(await screen.findByText("API says again@example.com")).toBeVisible();
  });

  it("signs out to the sign-in screen with no message, forgetting the session", async () => {
    stubBackend({ "GET /api/me": meRoute });
    const { user, client } = renderGate("/");
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    await screen.findByText("API says test@accountable.local");

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(screen.queryByText(/Your session has ended/)).not.toBeInTheDocument();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("shows the name a renewed session carries", async () => {
    let tokens = 0;
    stubBackend({
      "GET /api/me": meRoute,
      "POST /api/local-auth/token": () =>
        json(200, session(`token-${++tokens}`, tokens === 1 ? USER : renamed("Tess User"))),
    });
    const { user } = renderGate("/");
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    await screen.findByText("Signed in as Test User");

    await (await openAccount()).auth.refreshSession();

    expect(await screen.findByText("Signed in as Tess User")).toBeVisible();
  });

  it("shows the person a session signed in from another tab names", async () => {
    stubBackend({ "GET /api/me": meRoute });
    const { user } = renderGate("/");
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    await screen.findByText("Signed in as Test User");

    const otherTab = new BroadcastChannel(SESSION_KEY);
    otherTab.postMessage({
      event: "SIGNED_IN",
      session: session("other-tab", renamed("Jane Smith")),
    });
    otherTab.close();

    expect(await screen.findByText("Signed in as Jane Smith")).toBeVisible();
  });

  it("says when sign-in can't be reached, and tries again on signing in", async () => {
    stubBackend({ "GET /api/config": () => json(503) });
    const { user } = renderGate("/");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't reach Accountable's sign-in.",
    );

    stubBackend({ "GET /api/me": meRoute });
    await user.type(screen.getByLabelText("Email"), "test@accountable.local");
    await user.type(screen.getByLabelText("Password"), "local-test-only");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Page at /")).toBeVisible();
  });
});
