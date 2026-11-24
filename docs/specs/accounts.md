# Spec: Accounts

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers signing in and out, the people who use Accountable, who added and last changed each record, and the user menu. The theme choice inside the menu is in [look-and-feel.md](look-and-feel.md#light-and-dark-mode).

## Concerns

- **Concern 16: Two ways to sign in.** The built app, on Render and on this computer, signs people in with Supabase Auth. `npm run dev`, `npm run seed` and the tests must never touch Supabase, and CI has no secrets, so they use local sign-in instead: the backend stands in for Supabase Auth with one test user, Test User, whose email and password are written in this spec and are nobody's real password. The local stand-in answers the same sign-in requests as Supabase Auth, so the frontend's code is the same in both, and the end-to-end tests sign in through the real sign-in screen. Which one runs is set by how the app starts, never by a request. Local sign-in refuses to start with a Postgres database, and a token from one is never accepted by the other.
- **Concern 17: Where names come from.** People, with their email and display name, live in Supabase Auth. The browser holds only the publishable key, which can't list other people, so the backend keeps its own `users` table: each request's token carries that person's id, email and display name, and the backend adds or updates their row. Records then point at a row in `users`. The user menu (U11, U12) reads the person's own name and email from the same token, not from `GET /me`. A name changed in Supabase's dashboard shows once that person's session renews (at most an hour) and they next use Accountable.
- **Concern 18: Records nobody signed in to add.** The sample data has no one to credit, so its records have no one recorded and show "Sample data". The same goes for anything in a local SQLite file that was added before sign-in existed, since nobody was recorded then either.
- **Concern 19: A session that ends while someone is working.** A session renews itself while Accountable is open, so it ends only when Supabase refuses to renew it, such as after the person is removed or signed out everywhere. Then the next page or save shows the sign-in screen, and anything typed in an open form is lost. Keeping a half-filled form across signing in again isn't worth the code for something this rare.

## Requirements

### Signing in

- **U1** Signed out, every page shows the sign-in screen, whatever its address. After signing in, the page that was asked for opens.
- **U2** The sign-in screen asks for an email and a password. A wrong email or password says "That email and password don't match. Try again, or ask whoever runs Accountable for your team." It keeps the email and clears the password. When Supabase can't be reached it says "Couldn't reach Accountable's sign-in. Check your internet connection and try again." It says the same when Accountable can't load which sign-in to use (`GET /config`), and Sign in then tries again. There's no sign-up, no password reset and no other way to sign in. People are added in Supabase's dashboard, with an email, a password and a display name.
- **U3** The session is kept in this browser, so a refresh or a restart keeps the person signed in, and it renews itself while the app is open. If it ends (Concern 19), the sign-in screen says "Your session has ended. Sign in again." and, once signed in, returns to the same page.
- **U4** "Sign out" in the user menu ends the session in this browser, clears the data the app was holding, and shows the sign-in screen. The theme choice stays (M2).
- **U5** Every API route except `GET /health`, `GET /config` and local sign-in refuses a request without a valid, unexpired token, with status 401 and the message "Sign in to use Accountable." The backend takes the person from the token alone. Anything in a request that names a person, such as a user id in a body, is ignored.
- **U6** Everyone signed in can see and change everything. There are no roles or permissions.
- **U7** Local sign-in (Concern 16) has one person, Test User, with the email `test@accountable.local` and the password `local-test-only`. Its sign-in screen comes filled in with them, under a note that says "Local test mode. Nothing here touches Supabase." It's on for `npm run dev`, `npm run seed` and the tests, and never for `npm start` or Render.

### Who added what

- **U8** Each organization, contact, deal and activity records who added it and who last changed it. Adding a record sets both. Editing it, moving a deal on the board or marking a follow-up done sets who last changed it. When a rule changes another record, such as D5 making a contact a customer, that record's last change is credited to the person whose action set it off. A link the database clears because another record was deleted (O4, C6) doesn't count as a change. Nor does renumbering a pipeline column to make room for a moved card ([card order](pipeline.md#data-model)): the other deals keep who last changed them and when.
- **U9** A person is shown by their display name, or by their email when they have no name. A record with no one recorded shows "Sample data" (Concern 18).
- **U10** Organization, contact and deal pages show, at the foot of the details panel, "Added by Jane Smith on 3 Nov 2026" and "Last changed by Sam Lee on 16 Nov 2026". Each activity on a timeline shows who added it. Stage changes don't record who made them.

### User menu

- **U11** The user menu sits at the right of the top bar on every page: a circle with the person's initials. The initials are the first letters of the first and last words of the display name, or one letter for a one-word name, or the email's first letter when there's no name, in capitals.
- **U12** The menu shows the person's name and email, the theme choice (M1) and "Sign out". It opens with a click, or with Enter or Space when the circle has keyboard focus. The arrow keys move through it, and Escape or a click outside closes it and puts focus back on the circle. Screen readers announce the circle as "Account menu for Jane Smith".

## Design

### Data model

**users**

| Column | Type | Notes |
| --- | --- | --- |
| auth_id | text | required, unique: the person's id in Supabase Auth, or `local-test-user` for local sign-in |
| email | text | required, from the token |
| name | text | optional, the display name from the token's Supabase user metadata: `display_name`, then `full_name`, then `name` |

A request updates the person's row only when the email or name in the token differs from it, so most requests don't write.

Organizations, contacts, deals and activities each have two more columns:

| Column | Type | Notes |
| --- | --- | --- |
| created_by | int | who added it, `ON DELETE SET NULL`; null for the sample data |
| updated_by | int | who last changed it, `ON DELETE SET NULL`; null for the sample data |

### API

| Method and path | Purpose |
| --- | --- |
| `GET /config` | no sign-in needed: which sign-in to use, and for Supabase its URL and publishable key |
| `GET /me` | the signed-in person: name, email and the name to show (U9) |
| `/local-auth/...` | local sign-in only (U7): the part of Supabase Auth the frontend uses, which is signing in with a password, renewing a session, reading the person and signing out. Missing (404) in the built app. |

The responses for an organization, contact or deal include who added it and who last changed it, each as the name to show (U9) with the date. Timeline activities include who added them.

**Checking the token.** With Supabase, the backend checks each token's signature against the signing keys Supabase publishes for the project, fetched once and kept, and checks it hasn't expired. With local sign-in, the backend makes its own key when it starts and accepts only tokens signed with it. Either way the token gives the person's id, email and display name.

### Screens

**Sign-in.** No sidebar or top bar. One panel, 400 px wide, centered on the page background, with the Accountable wordmark at the top, "Sign in" as the heading, the Email and Password fields, and a full-width Sea Green "Sign in" button with Midnight text. An error sits under the button in the Raspberry text shade. "Your session has ended. Sign in again." (U3) sits in the same place in the usual text color, since it isn't an error. Under that, in secondary text: "No account, or forgot your password? Ask whoever runs Accountable for your team." With local sign-in, the note from U7 sits above the fields on a Marigold fill with Midnight text. The screen follows the saved theme.

**User menu.** The circle is 32 px, Sea Green with the initials in Midnight, Instrument Sans 13 px semibold. The menu opens under it, aligned to its right edge: a panel 260 px wide with 12 px rounded corners and the usual shadow. It shows the name (14 px semibold) and email (13 px, secondary text), then "Theme" with three buttons side by side, Light (sun icon), Dark (moon icon) and System (monitor icon), the chosen one on Sea Green with Midnight text, then "Sign out" with a log-out icon. Groups are set apart by space, not lines.
