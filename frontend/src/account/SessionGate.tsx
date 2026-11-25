import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/auth-js";
import { connectSession } from "../shared/api";
import { useClearAll } from "../shared/queryClient";
import {
  openAccount,
  personOf,
  SessionProvider,
  signInWithPassword,
  type Account,
  type Person,
  type SignInFailure,
} from "./session";
import { SignInPage, type Notice } from "./SignInPage";

type GateState =
  | { status: "opening" }
  | { status: "signed-out"; notice: Notice | null }
  | { status: "signed-in"; person: Person };

const signedIn = (session: Session): GateState => ({
  status: "signed-in",
  person: personOf(session.user),
});

/**
 * Shows the sign-in screen at whatever address was asked for, and that page once signed
 * in (U1). The address never changes, so after a session ends, signing in again returns
 * to the same page (U3).
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const clearAll = useClearAll();
  const [account, setAccount] = useState<Account | null>(null);
  const [state, setState] = useState<GateState>({ status: "opening" });
  // Signing in waits for the last session to be removed, so its removal can't take the new one.
  const leaving = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let live = true;
    openAccount()
      .then(async (opened) => {
        const { data } = await opened.auth.getSession();
        if (!live) return;
        setAccount(opened);
        setState(data.session ? signedIn(data.session) : { status: "signed-out", notice: null });
      })
      .catch(() => {
        if (live) setState({ status: "signed-out", notice: "unreachable" });
      });
    return () => {
      live = false;
    };
  }, []);

  // A renewed session, or one signed in from another tab, may name the person differently,
  // and requests already send its token, so the menu follows it (Concern 17).
  useEffect(() => {
    if (!account) return;
    const { data } = account.auth.onAuthStateChange((_event, session) => {
      if (session)
        setState((current) => (current.status === "signed-in" ? signedIn(session) : current));
    });
    return () => data.subscription.unsubscribe();
  }, [account]);

  function leave(notice: Notice | null) {
    setState({ status: "signed-out", notice });
    clearAll();
    leaving.current = account?.auth.signOut({ scope: "local" }) ?? Promise.resolve();
    return leaving.current;
  }

  const sessionEnded = useEffectEvent(() => void leave("ended"));

  // A layout effect, so requests carry the token from the app's first render on.
  const isSignedIn = state.status === "signed-in";
  useLayoutEffect(() => {
    if (!isSignedIn || !account) return;
    return connectSession({
      accessToken: async () => (await account.auth.getSession()).data.session?.access_token ?? null,
      ended: () => sessionEnded(),
    });
  }, [isSignedIn, account]);

  async function signIn(email: string, password: string): Promise<SignInFailure | null> {
    await leaving.current;
    const opened = account ?? (await openAccount().catch(() => null));
    if (!opened) return "unreachable";
    setAccount(opened);
    const result = await signInWithPassword(opened.auth, email, password);
    if (typeof result === "string") return result;
    setState(signedIn(result));
    return null;
  }

  if (state.status === "opening") return null;
  if (state.status === "signed-out")
    return <SignInPage local={account?.local ?? false} notice={state.notice} signIn={signIn} />;
  const signOut = async () => {
    await leave(null);
  };
  return <SessionProvider value={{ person: state.person, signOut }}>{children}</SessionProvider>;
}
