// Talks to the backend: sends the session's token (U5) and the user's today (G10),
// hands a refused session to the session gate (U3), and turns every other failure
// into a short, plain message (G8).
import type { components } from "./api-types";
import { localToday } from "./today";

export type Schemas = components["schemas"];

export const NETWORK_MESSAGE =
  "Accountable isn't answering. Check it's still running, then try again.";
export const GENERAL_MESSAGE =
  "Something went wrong in Accountable. Try again, and if it keeps happening, restart the app.";

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;

  constructor(message: string, status = 0, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

/** How the session gate and `api` talk: the gate supplies the token and hears when it's refused. */
export type SessionLink = {
  /** The current access token, renewed first if it's due, or null when signed out. */
  accessToken: () => Promise<string | null>;
  /** Called once, on the first 401 for one of its requests, when the backend no longer accepts it. */
  ended: () => void;
};

let session: SessionLink | null = null;

/** Connects the signed-in session to every request. Returns the function that disconnects it. */
export function connectSession(link: SessionLink): () => void {
  session = link;
  return () => {
    if (session === link) session = null;
  };
}

async function authorization(link: SessionLink | null): Promise<Record<string, string>> {
  const token = await link?.accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * A refused session is told to the gate once and the request never settles, so no
 * screen raises a toast or an error for it (R12). The gate replaces the app with the
 * sign-in screen and clears the cached queries, which drops these requests.
 * Only the session that sent the request is ended: a late refusal for an earlier
 * session mustn't end the one signed in since (U3).
 */
function sessionEnded(link: SessionLink | null): Promise<never> {
  if (link !== null && session === link) {
    session = null;
    link.ended();
  }
  return new Promise<never>(() => {});
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export async function api<T>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  const link = session;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(await authorization(link)),
        "X-Local-Date": localToday(),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(NETWORK_MESSAGE);
  }
  if (response.status === 401) return sessionEnded(link);
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw failure(response.status, data);
  return data as T;
}

function failure(status: number, data: unknown): ApiError {
  const payload = (data ?? {}) as { message?: unknown; fields?: unknown };
  const message =
    typeof payload.message === "string" && status < 500 ? payload.message : GENERAL_MESSAGE;
  const fields =
    payload.fields && typeof payload.fields === "object"
      ? (payload.fields as Record<string, string>)
      : {};
  // A reply that isn't ours (such as the dev proxy failing) means the backend isn't running.
  const unreachable = data === null && status >= 500;
  return new ApiError(unreachable ? NETWORK_MESSAGE : message, status, fields);
}

/** "Couldn't save the deal. Accountable isn't answering..." for toasts. */
export function failureMessage(action: string, error: unknown): string {
  const detail = error instanceof ApiError ? error.message : GENERAL_MESSAGE;
  return `Couldn't ${action}. ${detail}`;
}
