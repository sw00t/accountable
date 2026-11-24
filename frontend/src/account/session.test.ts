import type { User } from "@supabase/auth-js";
import { openAccount, personOf, SESSION_KEY, signInWithPassword } from "./session";

const LOCAL = { sign_in: "local", supabase_url: null, supabase_publishable_key: null };
const SUPABASE = {
  sign_in: "supabase",
  supabase_url: "https://project.supabase.co",
  supabase_publishable_key: "sb_publishable_key",
};

const SESSION = {
  access_token: "access",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "refresh",
  user: { id: "u1", email: "test@accountable.local", user_metadata: {} },
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
  });
}

/** Answers `/config` with `config` and any sign-in with `signIn`, recording each request. */
function stubFetch(config: unknown, signIn: () => Response | Promise<Response>) {
  const requests: { url: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      requests.push({ url, headers: (init.headers ?? {}) as Record<string, string> });
      return url === "/api/config" ? reply(200, config) : signIn();
    }),
  );
  return requests;
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("the auth client", () => {
  it("signs in through local sign-in when /config says so, and keeps the session", async () => {
    const requests = stubFetch(LOCAL, () => reply(200, SESSION));
    const account = await openAccount();

    await signInWithPassword(account.auth, "test@accountable.local", "local-test-only");

    expect(account.local).toBe(true);
    expect(requests.at(-1)?.url).toBe(
      `${window.location.origin}/api/local-auth/token?grant_type=password`,
    );
    expect(JSON.parse(localStorage.getItem(SESSION_KEY) ?? "{}").access_token).toBe("access");
  });

  it("signs in through Supabase with the publishable key when /config says so", async () => {
    const requests = stubFetch(SUPABASE, () => reply(200, SESSION));
    const account = await openAccount();

    await signInWithPassword(account.auth, "jane@example.com", "secret");

    expect(account.local).toBe(false);
    expect(requests.at(-1)?.url).toBe(
      "https://project.supabase.co/auth/v1/token?grant_type=password",
    );
    expect(requests.at(-1)?.headers.apikey).toBe("sb_publishable_key");
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it("can't open without Supabase's address", async () => {
    stubFetch({ ...SUPABASE, supabase_url: null }, () => reply(200, SESSION));
    await expect(openAccount()).rejects.toThrow();
  });
});

describe("signing in", () => {
  it("tells a wrong email or password apart from an unreachable sign-in", async () => {
    stubFetch(LOCAL, () => reply(400, { code: "invalid_credentials", msg: "Invalid login" }));
    const { auth } = await openAccount();
    expect(await signInWithPassword(auth, "test@accountable.local", "wrong")).toBe("mismatch");

    stubFetch(LOCAL, () => Promise.reject(new TypeError("Failed to fetch")));
    expect(await signInWithPassword(auth, "test@accountable.local", "x")).toBe("unreachable");
  });
});

describe("personOf", () => {
  const user = (user_metadata: Record<string, unknown>) =>
    ({ id: "u1", email: "jane@example.com", user_metadata }) as unknown as User;

  it("takes the display name, or the usual alternatives, as the backend does", () => {
    expect(personOf(user({ display_name: " Jane Smith " })).name).toBe("Jane Smith");
    expect(personOf(user({ full_name: "Sam Lee" })).name).toBe("Sam Lee");
    expect(personOf(user({ display_name: "  " }))).toEqual({
      name: null,
      email: "jane@example.com",
    });
  });
});
