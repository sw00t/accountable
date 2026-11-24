import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { SessionProvider, type Person } from "../account/session";
import { connectSession, type Schemas } from "./api";
import { ToastProvider } from "./Toast";

export function testClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function renderWithProviders(ui: ReactElement, client = testClient(), path = "/") {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <ToastProvider>{ui}</ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

export const TEST_TOKEN = "test-token";

/**
 * Signs in for the rest of the test, as the session gate would: every request carries
 * `token`. `ended` records the session gate being told the session has ended.
 */
export function signIn(token = TEST_TOKEN) {
  const ended = vi.fn();
  onTestFinished(connectSession({ accessToken: async () => token, ended }));
  return { ended };
}

export const TEST_PERSON: Person = { name: "Test User", email: "test@accountable.local" };

/** `ui` with the app's providers, signed in as `person`. `signOut` records signing out. */
export function renderSignedIn(
  ui: ReactElement,
  client = testClient(),
  path = "/",
  person = TEST_PERSON,
) {
  const signOut = vi.fn(async () => {});
  const session = <SessionProvider value={{ person, signOut }}>{ui}</SessionProvider>;
  return { ...signIn(), signOut, ...renderWithProviders(session, client, path) };
}

/** The whole app, with its sidebar and routes, opened at `path` and signed in. */
export function renderApp(path: string, client = testClient()) {
  return renderSignedIn(<App />, client, path);
}

// --- Records as the API returns them, with overrides for what a test cares about ---

const STAMPS = {
  created_at: "2026-01-01T00:00:00",
  updated_at: "2026-01-01T00:00:00",
  added_by: "Jane Smith",
  changed_by: "Sam Lee",
};

export function dealRow(overrides: Partial<Schemas["DealRow"]> = {}): Schemas["DealRow"] {
  return {
    id: 1,
    name: "Fleet renewal",
    stage: "proposal",
    position: 1,
    value: 10000,
    probability: 50,
    expected_revenue: 5000,
    organization_id: 2,
    contact_id: 7,
    organization_name: "Bolt Freight",
    contact_name: "Ann Bolt",
    close_date: "2026-12-01",
    is_late: false,
    ...STAMPS,
    ...overrides,
  };
}

export function contactRow(overrides: Partial<Schemas["ContactRow"]> = {}): Schemas["ContactRow"] {
  return {
    id: 7,
    name: "Ann Bolt",
    email: "ann@bolt.example",
    phone: "0113 496 0000",
    job_title: "Buyer",
    organization_id: 2,
    organization_name: "Bolt Freight",
    status: "lead",
    last_activity_on: "2026-11-02",
    ...STAMPS,
    ...overrides,
  };
}

export function organizationRow(
  overrides: Partial<Schemas["OrganizationRow"]> = {},
): Schemas["OrganizationRow"] {
  return {
    id: 2,
    name: "Bolt Freight",
    website: "https://bolt.example",
    industry: "Logistics",
    notes: null,
    contact_count: 1,
    open_deal_count: 1,
    open_value: 10000,
    ...STAMPS,
    ...overrides,
  };
}

export function timelineEntry(
  overrides: Partial<Schemas["TimelineEntry"]> = {},
): Schemas["TimelineEntry"] {
  return {
    kind: "activity",
    id: 30,
    on: "2026-11-03",
    at: "2026-11-03T10:00:00",
    text: "Called about the renewal",
    type: "call",
    description: "Called about the renewal",
    occurred_on: "2026-11-03",
    follow_up_on: null,
    follow_up_status: null,
    done: false,
    added_by: "Jane Smith",
    ...overrides,
  };
}

export function list<T>(items: T[]) {
  return { items, total: items.length };
}

type Handler = (body: unknown, method: string) => { status?: number; body?: unknown };

/** Stubs fetch with handlers keyed by "METHOD /path". Returns the calls made. */
export function mockApi(routes: Record<string, Handler | unknown>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const path = url.replace(/^\/api/, "");
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      const route = routes[`${method} ${path}`];
      if (route === undefined)
        return new Response(JSON.stringify({ message: "not mocked" }), {
          status: 404,
        });
      const reply =
        typeof route === "function" ? (route as Handler)(body, method) : { body: route };
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
        status: reply.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}
