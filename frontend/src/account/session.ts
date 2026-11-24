// Where people sign in (Concern 16): `/config` says Supabase Auth or local sign-in, and
// both answer the same auth-js requests, so the rest of the frontend is the same in both.
import { createContext, useContext } from "react";
import { GoTrueClient, type Session, type User } from "@supabase/auth-js";
import { api, type Schemas } from "../shared/api";

/** Where the browser keeps the session, so a refresh or restart stays signed in (U3). */
export const SESSION_KEY = "accountable.session";

export type Account = { local: boolean; auth: GoTrueClient };

export type SignInFailure = "mismatch" | "unreachable";

/** The signed-in person, as their token names them. */
export type Person = { name: string | null; email: string };

type SignInConfig = Schemas["SignInConfig"];

// One client per address: two clients sharing one stored session would each renew it (R5).
const clients = new Map<string, GoTrueClient>();

export async function openAccount(): Promise<Account> {
  const config = await api<SignInConfig>("/config");
  const local = config.sign_in === "local";
  return { local, auth: local ? localClient() : supabaseClient(config) };
}

function localClient(): GoTrueClient {
  return client(`${window.location.origin}/api/local-auth`, {});
}

function supabaseClient({ supabase_url, supabase_publishable_key }: SignInConfig): GoTrueClient {
  if (!supabase_url || !supabase_publishable_key) throw new Error("Supabase isn't set up");
  return client(`${supabase_url.replace(/\/$/, "")}/auth/v1`, { apikey: supabase_publishable_key });
}

function client(url: string, headers: Record<string, string>): GoTrueClient {
  let auth = clients.get(url);
  if (!auth) {
    auth = new GoTrueClient({
      url,
      headers,
      storageKey: SESSION_KEY,
      persistSession: true,
      autoRefreshToken: true,
      // Only passwords sign in (U2), so no session ever arrives in the address.
      detectSessionInUrl: false,
    });
    clients.set(url, auth);
  }
  return auth;
}

export async function signInWithPassword(
  auth: GoTrueClient,
  email: string,
  password: string,
): Promise<Session | SignInFailure> {
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (data.session) return data.session;
  return error?.code === "invalid_credentials" ? "mismatch" : "unreachable";
}

/** The display name the backend reads from the same token (R18), or none. */
export function personOf(user: User): Person {
  const metadata = user.user_metadata ?? {};
  const name = [metadata.display_name, metadata.full_name, metadata.name].find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  return { name: name?.trim() ?? null, email: user.email ?? "" };
}

export type SessionValue = { person: Person; signOut: () => Promise<void> };

const SessionContext = createContext<SessionValue | null>(null);

/** Holds the signed-in person and signing out. Tests can fill it without auth-js. */
export const SessionProvider = SessionContext.Provider;

export function useSession(): SessionValue {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession is only for signed-in screens");
  return session;
}
