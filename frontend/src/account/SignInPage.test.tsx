import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInPage, type Notice } from "./SignInPage";
import type { SignInFailure } from "./session";

function renderPage({
  local = false,
  notice = null,
  failure = null,
}: { local?: boolean; notice?: Notice | null; failure?: SignInFailure | null } = {}) {
  const signIn = vi.fn(async () => failure);
  render(<SignInPage local={local} notice={notice} signIn={signIn} />);
  return { signIn, user: userEvent.setup() };
}

const email = () => screen.getByLabelText("Email");
const password = () => screen.getByLabelText("Password");
const submit = () => screen.getByRole("button", { name: "Sign in" });

describe("SignInPage", () => {
  it("signs in with the email and password typed", async () => {
    const { signIn, user } = renderPage();

    await user.type(email(), " jane@example.com ");
    await user.type(password(), "secret");
    await user.click(submit());

    expect(signIn).toHaveBeenCalledWith("jane@example.com", "secret");
    expect(screen.queryByText(/Local test mode/)).not.toBeInTheDocument();
  });

  it("says a wrong email or password don't match, keeping the email and clearing the password", async () => {
    const { user } = renderPage({ failure: "mismatch" });

    await user.type(email(), "jane@example.com");
    await user.type(password(), "wrong");
    await user.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email and password don't match. Try again, or ask whoever runs Accountable for your team.",
    );
    expect(email()).toHaveValue("jane@example.com");
    expect(password()).toHaveValue("");
    expect(password()).toHaveFocus();
  });

  it("says when sign-in can't be reached", async () => {
    const { user } = renderPage({ failure: "unreachable" });

    await user.type(email(), "jane@example.com");
    await user.type(password(), "secret");
    await user.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't reach Accountable's sign-in. Check your internet connection and try again.",
    );
    expect(password()).toHaveValue("secret");
  });

  it("comes filled in with Test User under the local note for local sign-in", async () => {
    const { signIn, user } = renderPage({ local: true });

    expect(screen.getByText("Local test mode. Nothing here touches Supabase.")).toBeVisible();
    expect(email()).toHaveValue("test@accountable.local");
    expect(password()).toHaveValue("local-test-only");

    await user.click(submit());
    expect(signIn).toHaveBeenCalledWith("test@accountable.local", "local-test-only");
  });

  it("says when the session has ended", () => {
    renderPage({ notice: "ended" });
    expect(screen.getByRole("status")).toHaveTextContent("Your session has ended. Sign in again.");
  });

  it("offers no other way in: no sign-up, no reset, one button", () => {
    renderPage();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.getByText(
        "No account, or forgot your password? Ask whoever runs Accountable for your team.",
      ),
    ).toBeVisible();
  });
});
