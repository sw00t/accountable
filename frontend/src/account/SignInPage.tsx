import { useRef, useState, type FormEvent } from "react";
import { Field } from "../shared/Field";
import type { SignInFailure } from "./session";
import "./account.css";

/** Why the screen opened with a message: the session ended (U3), or sign-in can't be reached. */
export type Notice = "ended" | "unreachable";

type Message = Notice | SignInFailure;

const MESSAGES: Record<Message, string> = {
  ended: "Your session has ended. Sign in again.",
  mismatch:
    "That email and password don't match. Try again, or ask whoever runs Accountable for your team.",
  unreachable:
    "Couldn't reach Accountable's sign-in. Check your internet connection and try again.",
};

// Local sign-in's only person (U7). Written in the spec, and nobody's real password.
const TEST_USER = { email: "test@accountable.local", password: "local-test-only" };

type Props = {
  local: boolean;
  notice: Notice | null;
  /** Resolves to null once signed in, when this screen gives way to the app. */
  signIn: (email: string, password: string) => Promise<SignInFailure | null>;
};

export function SignInPage({ local, notice, signIn }: Props) {
  const [email, setEmail] = useState(local ? TEST_USER.email : "");
  const [password, setPassword] = useState(local ? TEST_USER.password : "");
  const [message, setMessage] = useState<Message | null>(notice);
  const [submitting, setSubmitting] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const failure = await signIn(email.trim(), password);
    if (!failure) return;
    setSubmitting(false);
    setMessage(failure);
    if (failure === "mismatch") {
      setPassword("");
      passwordInput.current?.focus();
    }
  }

  return (
    <main className="sign-in">
      <form className="panel sign-in-panel" aria-labelledby="sign-in-heading" onSubmit={submit}>
        <div className="sign-in-brand">
          <span className="mark" aria-hidden="true">
            A
          </span>
          Accountable
        </div>
        <h1 id="sign-in-heading">Sign in</h1>
        {local && <p className="sign-in-local">Local test mode. Nothing here touches Supabase.</p>}
        <Field id="sign-in-email" label="Email">
          <input
            id="sign-in-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field id="sign-in-password" label="Password">
          <input
            id="sign-in-password"
            ref={passwordInput}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <button type="submit" className="btn sign-in-submit" disabled={submitting}>
          Sign in
        </button>
        {message && <SignInMessage message={message} />}
        <p className="sign-in-help">
          No account, or forgot your password? Ask whoever runs Accountable for your team.
        </p>
      </form>
    </main>
  );
}

function SignInMessage({ message }: { message: Message }) {
  if (message === "ended")
    return (
      <p className="sign-in-message" role="status">
        {MESSAGES.ended}
      </p>
    );
  return (
    <p className="sign-in-message error" role="alert">
      {MESSAGES[message]}
    </p>
  );
}
