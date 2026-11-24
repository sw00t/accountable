// The app starts in the page's root element, behind the session gate, on the dashboard.
import { act, screen } from "@testing-library/react";
import { SESSION_KEY } from "./account/session";
import { mockApi } from "./shared/test-utils";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const LOCAL = { sign_in: "local", supabase_url: null, supabase_publishable_key: null };

function storedSession(token: string) {
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `refresh-${token}`,
    user: { id: "local-test-user", email: "test@accountable.local", user_metadata: {} },
  };
}

test("signed in, the app starts on the dashboard in the page's root element", async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(storedSession("kept")));
  mockApi({ "GET /config": LOCAL, "GET /dashboard": () => ({ status: 500, body: {} }) });
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  await act(() => import("./main"));
  expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  expect(root).toContainElement(screen.getByRole("navigation", { name: "Sections" }));
  const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([url]) =>
    String(url).endsWith("/dashboard"),
  )!;
  expect(init.headers.Authorization).toBe("Bearer kept");
});
