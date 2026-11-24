import { test, expect, API, SESSION_KEY, SIGNED_OUT, TEST_USER, signIn, signInScreen } from "./fixtures";

const SIGN_IN_MESSAGE = { message: "Sign in to use Accountable.", fields: {} };

test.describe("signed out", () => {
  test.use(SIGNED_OUT);

  test("TE30 every page shows the sign-in screen and the API refuses without a token", async ({ page, request }) => {
    for (const path of ["/", "/contacts", "/deals/1", "/pipeline"]) {
      await page.goto(path);
      await expect(signInScreen(page)).toBeVisible();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
    }

    for (const path of ["/organizations", "/contacts/1", "/deals", "/dashboard", "/me"]) {
      const response = await request.get(`${API}${path}`);
      expect(response.status(), path).toBe(401);
      expect(await response.json(), path).toEqual(SIGN_IN_MESSAGE);
    }
    expect((await request.get(`${API}/health`)).ok()).toBeTruthy();
  });

  test("TE31 signing in on the filled-in screen opens the page asked for, and a reload stays signed in", async ({
    page,
  }) => {
    await page.goto("/organizations");
    await expect(signInScreen(page)).toBeVisible();
    await expect(page.getByText("Local test mode. Nothing here touches Supabase.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(TEST_USER.email);
    await expect(page.getByLabel("Password")).toHaveValue(TEST_USER.password);
    await expect(
      page.getByText("No account, or forgot your password? Ask whoever runs Accountable for your team."),
    ).toBeVisible();

    await signIn(page);
    await expect(page.getByRole("heading", { level: 1, name: "Organizations" })).toBeVisible();
    await expect(page).toHaveURL("/organizations");
    expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).not.toBeNull();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Organizations" })).toBeVisible();
    await expect(signInScreen(page)).toHaveCount(0);
  });

  test.describe("with a wrong password", () => {
    // The browser logs the refused sign-in; the screen explains it.
    test.use({ allowConsoleErrors: [/status of 400/] });

    test("TE32 shows the message, keeps the email and clears the password", async ({ page }) => {
      await page.goto("/");
      await expect(signInScreen(page)).toBeVisible();
      await page.getByLabel("Password").fill("not-the-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("alert")).toHaveText(
        "That email and password don't match. Try again, or ask whoever runs Accountable for your team.",
      );
      await expect(page.getByLabel("Email")).toHaveValue(TEST_USER.email);
      await expect(page.getByLabel("Password")).toHaveValue("");
      await expect(signInScreen(page)).toBeVisible();

      await page.getByLabel("Password").fill(TEST_USER.password);
      await signIn(page);
      await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    });
  });
});

test.describe("when the session ends", () => {
  // The browser logs the refused requests (401), and signing out with the refused token (403),
  // as Supabase Auth answers; the sign-in screen explains them.
  test.use({ allowConsoleErrors: [/status of 40[13]/] });

  test("TE33 the next page says the session has ended, and signing in returns to it", async ({ page }) => {
    await page.goto("/deals/1");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(page.getByRole("region", { name: "Details" })).toBeVisible();
    const deal = (await heading.textContent()) ?? "";
    expect(deal).not.toBe("");

    // A token the backend no longer accepts, as after a restart or a revoked session.
    await page.evaluate((key) => {
      const session = JSON.parse(localStorage.getItem(key) ?? "{}");
      localStorage.setItem(key, JSON.stringify({ ...session, access_token: "not-a-real-token" }));
    }, SESSION_KEY);
    await page.reload();

    await expect(signInScreen(page)).toBeVisible();
    await expect(page.getByText("Your session has ended. Sign in again.")).toBeVisible();
    await expect(page).toHaveURL("/deals/1");

    await signIn(page);
    await expect(heading).toHaveText(deal);
    await expect(page.getByRole("region", { name: "Details" })).toBeVisible();
    await expect(page).toHaveURL("/deals/1");
  });
});
