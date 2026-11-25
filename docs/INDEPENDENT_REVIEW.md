# Independent review: multi-user

Reviewed `main...multi-user`, from `fe9b444` to `1a8acc7`, on 25 November 2026.
The emphasis was code quality and readability, with separate passes for behavior, security, the spec and plan, documentation coverage, and `docs/STANDARDS.md`, as required by `docs/REVIEW.md`.
There are **four Important findings and two nits**.

## Important findings

### 1. An old request can sign out a new session

**Location:** [frontend/src/shared/api.ts](../frontend/src/shared/api.ts#L54), lines 54–58 and 78.

`api()` obtains a token when it sends a request, but `sessionEnded()` uses whichever global `session` exists when the response arrives.
If two requests use an expired session, the first 401 can show sign-in; after the person signs in again, the second request's delayed 401 ends the new, valid session.
This breaks U3 and can discard a form opened after signing in again.
Clearing the query cache does not prevent this callback from running: `api()` does not cancel the underlying fetch.

**Evidence:** A probe sent two requests carrying `Bearer old-token`, delivered the first 401, connected a new session, then delivered the second 401.
Both the old and new sessions' `ended` callbacks ran once, although no request used the new token.
The existing API test checks concurrent refusals within one session, but does not reconnect before a delayed refusal arrives.

**Suggested change:** Capture the session link that owns each request and allow a refusal to end only that same link while it is still current.
Apply the ownership check across asynchronous token acquisition as well as response handling.
Add a regression test that reconnects between two deferred 401 responses.

### 2. The account menu keeps an outdated identity after renewal

**Location:** [frontend/src/account/SessionGate.tsx](../frontend/src/account/SessionGate.tsx#L45), lines 45–60, 75–77 and 88.

The gate copies `person` into React state at startup and explicit sign-in, but never subscribes to the auth client's session changes.
API requests read the renewed session through `getSession()`, while the menu continues to use the old copy of the person.
A name or email changed in Supabase therefore stays outdated in the menu until a reload or another explicit sign-in, contrary to Concern 17 and U11–U12.
This also leaves the gate unable to reflect an identity change received from another tab.

**Evidence:** A temporary Vitest probe signed in as `Original Name`, then used the real auth client's public `refreshSession()` method with a stubbed response naming `Updated Name`.
Both `getSession()` and stored session data contained `Updated Name`, while `useSession().person` still rendered `Original Name`.

**Suggested change:** Subscribe to `onAuthStateChange()` with cleanup and derive the displayed person from the current session, including renewal events.
Keep session transitions in one place so the token and displayed identity cannot drift apart.
Test a refreshed name and an externally changed session.

### 3. A failed search silently displays earlier results

**Location:** [frontend/src/search/useSearch.ts](../frontend/src/search/useSearch.ts#L43), lines 43–49; [frontend/src/search/SearchBox.tsx](../frontend/src/search/SearchBox.tsx#L176), the `found`/error rendering branch.

The hook returns `last` whenever the current query has no data, including after that query fails.
`SearchBox` gives `found` precedence over `error`, so after one successful search the error message is hidden by the earlier results.
For example, searching for `heath` after a successful `garcia` search can keep showing Garcia records indefinitely, with no indication that the new search failed.
This misses the search screen's specified “Couldn't search.” message and G8's error handling.

**Evidence:** A temporary Vitest probe returned Garcia results, changed the input to `heath`, then returned HTTP 500.
The input contained `heath`, the Garcia option remained visible, and no “Couldn't search.” message appeared.
The existing failure test starts without a previous result, so it misses this transition.

**Suggested change:** Retain earlier results only while the next search is pending, and explicitly display a final failure.
An explicit search state would make pending results, successful results and errors easier to distinguish than two independently nullable return values.
Add a success-to-failure regression test.

### 4. Local sign-out invalidates unrelated browser sessions

**Location:** [backend/app/routers/account.py](../backend/app/routers/account.py#L103), lines 103–109; [e2e/user-menu.spec.ts](../e2e/user-menu.spec.ts#L3), lines 3–4.

The frontend requests `signOut({ scope: "local" })`, but the local auth endpoint ignores the scope and clears the entire refresh-token dictionary.
Signing out in one browser therefore prevents every other local browser session from renewing.
Having one local user does not mean there is only one session; U4 promises sign-out in this browser, and the local stand-in is supposed to exercise the same frontend behavior as Supabase.

**Evidence:** A TestClient probe created two independent password sessions, signed the first out with `scope=local`, then renewed the second.
Logout returned 204, but the unrelated session's renewal returned 400 `refresh_token_not_found`.
The end-to-end test's comment says its sign-out leaves the shared saved session valid, which this implementation does not guarantee beyond access-token expiry.

**Suggested change:** Associate refresh tokens and their replacements with a stable session id and revoke only the requested session for local sign-out.
Preserve that id across renewals and the reuse interval.
Test that a second independent session can still renew after the first signs out, and correct the test comment to match the verified behavior.

## Nits

### 1. Bound the retry after a user insert fails

**Location:** [backend/app/auth.py](../backend/app/auth.py#L253), lines 253–260.

`_add()` treats every `IntegrityError` as a concurrent insert of the same `auth_id`, then recursively calls `person_for()`.
If an integrity failure has another cause and no matching user exists, this repeats until a recursion error hides the original database error.
After rollback, verify that the expected competing row exists before recovering; otherwise re-raise the original error.
A bounded recovery path makes the concurrency assumption explicit and easier to debug.

### 2. Make the lock regression test fail instead of hanging

**Location:** [backend/tests/test_auth.py](../backend/tests/test_auth.py#L400), lines 400–404.

The test acquires the private, non-reentrant `_lock` and calls `get()` on the same thread.
If the regression it guards against returns, the test deadlocks rather than reports a failed assertion.
The duration hook in `conftest.py` runs after a test returns, so it cannot interrupt this deadlock.
Use a blocked stub fetch on another thread, a bounded wait for the known-key lookup, and cleanup that always releases the blocked fetch.
That tests the promised behavior without depending directly on the lock field.

## Code quality assessment

The branch generally follows the existing structure well: backend rules stay on the backend, authorship joins are shared, search queries use bound values, and the frontend uses generated API types.
Most new helpers are short and have clear purposes.
The main maintenance problems are ownership across asynchronous work and copies of state that can disagree; the Important findings above show concrete consequences of those patterns.
No additional security finding was identified in this review, and the earlier review's resolved or explicitly accepted points in `docs/STATUS.md` are not repeated here.

## Validation

`npm run check` passed: **507 backend tests, 538 frontend unit tests and 56 end-to-end tests**, plus formatting, lint, type and secret checks.
The initial sandboxed attempt could not write to uv's cache; the approved rerun completed successfully.
The passing suite does not cover the four transitions reproduced above.

Additional checks used deferred fetch responses, two temporary Vitest probes, and an isolated local-auth TestClient probe.
The two Vitest probes passed assertions confirming the observed defects and were removed after use.
No Supabase or Render service was contacted for this review, and no application code was changed.
