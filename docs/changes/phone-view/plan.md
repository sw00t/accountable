# Plan: a phone view

This plan says how to build what `docs/changes/phone-view/intent.md` asks for and `docs/spec.md` and its area files specify. The phone's foundations come first (the phone size, AMOLED dark and the tab bar), then tables, forms, records, search and the menu, then the pipeline and the dashboard, then the finishing checks and the sign-off on a real phone.

IDs: N, M, T, P, U, F, H, A, C, D and O are the spec's requirements, in [look-and-feel.md](../../specs/look-and-feel.md), [tables-and-forms.md](../../specs/tables-and-forms.md), [pipeline.md](../../specs/pipeline.md), [accounts.md](../../specs/accounts.md), [search.md](../../specs/search.md), [dashboard.md](../../specs/dashboard.md), [activities.md](../../specs/activities.md) and the section files. CN24 to CN26 are the spec's new [Concerns](../../spec.md#concerns). IC1 to IC8 are the intent's [Constraints](intent.md#constraints) in order, and SC1 to SC7 its [Success criteria](intent.md#success-criteria). PT, PH, W, R, TF, TE and TM are this plan's parts, phases, work items, risks, and frontend, end-to-end and by-hand tests. Test IDs carry on from the earlier changes (TF33, TE37, TM19).

The backend doesn't change (IC1): the phone uses the same API, and "Move to" sends the same `POST /deals/{id}/move` a drop does.

## Files that change

The files are grouped into parts. Each file belongs to exactly one part, so each part can be built by a different agent without two of them editing the same file. Where one part needs something from another, the part that owns the file provides it, and the work items in [Order of work](#order-of-work) say which comes first.

Three choices keep the parts apart and the laptop unchanged:

- One phone query, written once in `shared/phone.ts` and copied into each stylesheet's `@media` rule, with a test that every copy matches (CN24). Components that need different markup ask `usePhone()`; everything else is CSS.
- No part edits `components.css` or `global.css`. Each part puts its phone rules in a stylesheet of its own, loaded after them and wrapped in the phone query, so on a laptop none of it applies (SC6).
- One bottom sheet, `shared/Sheet.tsx`, serves every sheet on a phone: a row's More menu, Sort by, Move to, the user menu, confirm dialogs and full-screen forms.

### Frontend

<a id="pt1"></a>**PT1 Phone size and AMOLED dark**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/shared/phone.ts` | `PHONE_QUERY`, the phone media query from CN24 (`(max-width: 767px), (orientation: landscape) and (max-height: 499px)`), and `usePhone()`, which follows it with `useSyncExternalStore`, so a component re-renders when the phone turns or a window is resized across it. `usePhoneShape()` also says portrait or landscape: landscape rules hang off a `landscape` class on `.app` rather than a media query of their own, since laptops are landscape too, and TF34 allows only the phone query in stylesheets | [W1.1](#w1-1) | New |
| `frontend/src/shared/theme/tokens.css` | AMOLED dark (M6): inside the phone query, `:root[data-theme="dark"]` overrides `--page`, `--panel`, a new `--raised`, `--line`, `--hover`, `--table-head`, `--field`, `--field-border`, `--scrim` and the shadows, with the values in the spec's AMOLED table. `--raised` gets a light and a dark value too, so the light tokens still define every token | [W1.1](#w1-1) | Changed |
| `frontend/src/shared/theme/tokens.testing.ts` | Reads the AMOLED block from inside the media query as a third set of tokens, `amoled`, layered on `dark` | [W1.1](#w1-1) | Changed |
| `frontend/src/shared/theme/contrast.test.ts`, `colors.test.ts` | TF35: the AMOLED pairs meet M5; the AMOLED block only overrides tokens the light block defines | [W1.1](#w1-1) | Changed |
| `frontend/src/shared/phone.test.ts` | TF34 | [W1.1](#w1-1) | New |
| `frontend/src/test-setup.ts` | A `matchMedia` stand-in for jsdom that tests can switch between phone and laptop (`setPhone(true)`), laptop by default, so every existing test runs as before (R9) | [W1.1](#w1-1) | Changed |
| `frontend/index.html` | `viewport-fit=cover` in the viewport tag, so the tab bar can keep clear of the home bar with `env(safe-area-inset-bottom)` (R4) | [W1.1](#w1-1) | Changed |

<a id="pt2"></a>**PT2 The shell: tab bar, rail, top bar and sheets**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/shared/Layout.tsx` | Renders the sidebar on a laptop and the tab bar on a phone, from `usePhoneShape()`, so there's only ever one "Sections" navigation; gives `.app` the `phone` and `portrait` or `landscape` classes; holds the top bar's title slot | [W1.2](#w1-2) | Changed |
| `frontend/src/shared/TabBar.tsx` | N4: the five sections as links with icon and short label, `aria-current` on the current one, in a `nav` named "Sections" on a phone. In landscape the stylesheet turns it into the rail, with the user menu's circle at its foot through a slot `UserMenu` fills | [W1.2](#w1-2) | New |
| `frontend/src/shared/Sidebar.tsx` | Exports the section list, with each section's short label, for the tab bar to share, so the two never differ | [W1.2](#w1-2) | Changed |
| `frontend/src/shared/TopBar.tsx` | On a phone: a slot on the left for the page's title and main action, and the search button and user menu on the right |
| `frontend/src/shared/topBarSlot.ts` | The context that hands the top bar's slot to `PageHeader` | [W1.2](#w1-2) | New |
| `frontend/src/shared/AddButton.tsx` | A page's main action: "Add contact" on a laptop and "Add" on a phone, named "Add contact" for screen readers either way. Used by the contacts, deals and organizations pages from PH1 | [W1.2](#w1-2) | New | [W1.2](#w1-2) | Changed |
| `frontend/src/shared/PageHeader.tsx` | On a phone, renders its title, summary and main action into the top bar's slot through a portal, with the action as "Add" and a plus icon (spec's Page header on a phone) | [W1.2](#w1-2) | Changed |
| `frontend/src/shared/Sheet.tsx` | The bottom sheet: a labelled modal dialog that rises from the bottom, with a grab handle, focus moved in and returned, Escape, tap outside and dragging the handle down to close, and a `full` variant for forms. Keeps the page from scrolling under it | [W1.2](#w1-2) | New |
| `frontend/src/account/account.css` | (PH1) The account circle keeps its 32 px look with a 44 px space to tap on a phone (N3); PT5 adds the menu's sheet in PH2 | [W1.2](#w1-2) | Changed |
| `frontend/src/shared/theme/phone.css` | The shell's phone rules: the tab bar and rail, the top bar, content margins, page header, sheets, and toasts above the tab bar; field text at 16 px (N7); 44 px tap targets for every shared button (N3); `body` without the laptop's 1280 px minimum. `main` scrolls sideways on its own as a safety net, so content that's too wide can't make the phone zoom out and push the tab bar off screen; TE38 checks no page needs it. Imported by `main.tsx` after `App`, so it comes after every other stylesheet | [W1.2](#w1-2) | New |
| `frontend/src/main.tsx` | Imports `phone.css` | [W1.2](#w1-2) | Changed |
| `frontend/src/shared/TabBar.test.tsx`, `Sheet.test.tsx` | TF36, TF37 | [W1.2](#w1-2) | New |

<a id="pt3"></a>**PT3 Tables, forms and dialogs**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/shared/DataTable.tsx` | T8: on a phone, a `phoneRow` prop gives each row's name, second line and end (status, stage or amount); rows render as a list with a More button (Edit, Delete) in a sheet; a "Sort by" button opens a sheet of the sortable columns, each in either order; paging as "26 to 50 of 412" between Previous and Next. Search, filters, sort and paging are the same TanStack table, so turning the phone keeps them (N5) | [W2.1](#w2-1) | Changed |
| `frontend/src/shared/TablePhone.tsx` | The table's phone pieces: the list of rows (with a space between a row's two lines, so screen readers hear them apart), the Sort by button and sheet (its words from a column's `sortWords`, or A to Z and lowest first), and the pager. Each list page gives `sortWords` for stage and date columns | [W2.1](#w2-1) | New |
| `frontend/src/shared/MoreMenu.tsx` | A 44 px More button that opens a sheet of named actions; shared by table rows, record pages and timeline entries (CN26) | [W2.1](#w2-1) | New |
| `frontend/src/shared/SidePanel.tsx` | Focuses the field a form marks `data-autofocus`, else the first, so Log activity starts in What happened (A7). Full screen on a phone with Cancel and Save at the bottom comes from `tables-phone.css` alone | [W2.1](#w2-1) | Changed |
| `frontend/src/shared/ConfirmDialog.tsx` | Imports `tables-phone.css`, which makes it a sheet on a phone with the buttons full width, danger on top; no markup changes | [W2.1](#w2-1) | Changed |
| `frontend/src/shared/tables-phone.css` | The list, More, Sort by, paging, form footer and confirm sheet rules | [W2.1](#w2-1) | New |
| `frontend/src/shared/DataTablePhone.test.tsx` | TF38, the More menu included | [W2.1](#w2-1) | New |

<a id="pt4"></a>**PT4 Sections: lists, record pages and the timeline**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/contacts/ContactsPage.tsx`, `deals/DealsPage.tsx`, `organizations/OrganizationsPage.tsx` | Each gives `DataTable` its `phoneRow`: C7, D11 and O5 | [W2.2](#w2-2) | Changed |
| `frontend/src/shared/RecordHeader.tsx` | A record page's header at both sizes: on a laptop the page header with Delete, as before; on a phone back and More (Edit, Delete) in the top bar, then the name, second line, status or stage, and the row of buttons (Log activity, and Call and Email when given). The page hands it the Log activity form as a function, so `shared` doesn't import from `activities` | [W2.2](#w2-2) | New |
| `frontend/src/contacts/ContactPage.tsx`, `deals/DealPage.tsx`, `organizations/OrganizationPage.tsx` | Use `RecordHeader` in place of `PageHeader`; Call and Email as `tel:` and `mailto:` links on a contact, left out when empty (C7); one column in portrait, two in landscape | [W2.2](#w2-2) | Changed |
| `frontend/src/activities/Timeline.tsx` | Each entry's Edit and Delete behind `MoreMenu` on a phone (A7) | [W2.2](#w2-2) | Changed |
| `frontend/src/activities/LogActivityForm.tsx` | On a phone, opened from the record's Log activity button in a full sheet with Call chosen; saving closes it (A7). On a laptop it stays at the top of the timeline (A3) | [W2.2](#w2-2) | Changed |
| `frontend/src/shared/records-phone.css` | Record header, action row, one and two columns, timeline rows | [W2.2](#w2-2) | New |
| `frontend/src/shared/RecordHeader.test.tsx`, `activities/TimelinePhone.test.tsx` | TF40, TF41 | [W2.2](#w2-2) | New |

<a id="pt5"></a>**PT5 Search, the user menu and sign-in**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/search/SearchBox.tsx` | F8: on a phone, a 44 px search button that opens search full screen with the box, Cancel and the results. Split in two: `SearchBox` chooses the button or the field and closes full-screen search on a page change; `SearchField` is the box with `useSearch` and the keyboard, unchanged. Cancel and Escape close it and put focus back on the button (N6). Full-screen search is a history entry of its own (router state), so the back button closes it on the same page, and choosing a result replaces that entry | [W2.3](#w2-3) | Changed |
| `frontend/src/search/search.css` | Full-screen search rules, inside the phone query | [W2.3](#w2-3) | Changed |
| `frontend/src/account/UserMenu.tsx` | U13: on a phone the menu opens in a `Sheet` with the same items and keyboard use; in landscape the stylesheet places the circle at the rail's foot | [W2.3](#w2-3) | Changed |
| `frontend/src/account/account.css` | The menu sheet, the circle at the rail's foot in landscape, and the sign-in panel on a phone | [W2.3](#w2-3) | Changed |
| `frontend/src/search/SearchBoxPhone.test.tsx`, `account/UserMenuPhone.test.tsx` | TF44, TF45 | [W2.3](#w2-3) | New |

<a id="pt6"></a>**PT6 Pipeline**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/pipeline/board.ts` | Pure functions for P10: `moveToStage` (the top of the new stage) and `moveWithin` (up or down one visible card, past cards a search hides as P4's drop does), each giving the same `Move` a drop gives, or none at the first or last place | [W3.1](#w3-1) | Changed |
| `frontend/src/pipeline/PipelinePage.tsx` | Renders `PhonePipeline` on a phone and the drag board on a laptop; the board sends its drops through `useSendMove` | [W3.1](#w3-1) | Changed |
| `frontend/src/pipeline/PhonePipeline.tsx` | On a phone: the stage tabs and one stage's cards, the stage kept in the address (`?stage=`), no drag sensors, the open totals under the title, and moves from the sheet sent through `useSendMove` as a drop's are (P6, P11), with the "Moved … to …" toast. In landscape the tabs and the stage's totals go into the top bar | [W3.1](#w3-1) | New |
| `frontend/src/pipeline/hooks.ts` | `useSendMove`: the drop's save path, moved out of the board so the sheet shares it: no save when the card stays put, and one move at a time per card (R6) | [W3.1](#w3-1) | Changed |
| `frontend/src/pipeline/StageTabs.tsx` | P9: the row of stage tabs, a tab list with the chosen one in view | [W3.1](#w3-1) | New |
| `frontend/src/pipeline/MoveSheet.tsx` | P10: the sheet with the six stages, "(now)", Move up and Move down | [W3.1](#w3-1) | New |
| `frontend/src/pipeline/Column.tsx`, `DealCard.tsx` | `ColumnFrame`, the column without drag, which both sizes use; on a phone the card's top lines link to the deal and its last line holds "Move to" | [W3.1](#w3-1) | Changed |
| `frontend/src/shared/stages.ts`, `deals/DealsPage.tsx` | `stageFromParam` moves to `stages.ts`, shared by the deals filter and the pipeline's stage | [W3.1](#w3-1) | Changed |
| `frontend/src/shared/Sheet.tsx` | The sheet's first focus skips a disabled button, such as the deal's own stage in Move to | [W3.1](#w3-1) | Changed |
| `frontend/src/pipeline/pipeline-phone.css` | Tabs, one column, cards full width, the Move to sheet, and in landscape the tabs in the top bar and two columns of cards | [W3.1](#w3-1) | New |
| `frontend/src/pipeline/board.test.tsx`, `PipelinePhone.test.tsx` | TF42, TF43 (the tabs and the sheet are tested through the page) | [W3.1](#w3-1) | Changed, one new |

<a id="pt7"></a>**PT7 Dashboard**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/dashboard/DashboardPage.tsx` | H9's order on a phone, through the stylesheet's grid order, so the markup stays as it is | [W3.2](#w3-2) | Changed |
| `frontend/src/dashboard/Charts.tsx` | Every third month's label on a phone, counting back from this month (`monthTicks`); charts 180 and 160 px high; tooltips open on a tap | [W3.2](#w3-2) | Changed |
| `frontend/src/dashboard/dashboard-phone.css` | One column in portrait, two in landscape; half-width tiles; the funnel's and stage bars' names above their bars; 56 px list rows with the date and a 44 px Mark done on the right. The funnel, lists and tiles change through this stylesheet alone, so their components don't change | [W3.2](#w3-2) | New |
| `frontend/src/dashboard/DashboardPage.test.tsx` | TF46 | [W3.2](#w3-2) | Changed |

### End-to-end tests

<a id="pt8"></a>**PT8 End to end at phone sizes**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `playwright.config.ts` | Three more projects in the installed Chrome with touch: `phone` (390 by 844), `phone-landscape` (844 by 390) and `phone-narrow` (360 by 780), each running only `e2e/phone/`. The `chrome` project ignores `e2e/phone/`, so the laptop tests run as before | [W1.3](#w1-3) | Changed |
| `e2e/fixtures.ts` | Helpers: no sideways scroll on the page, every visible button and link at least 44 by 44 px (measured once animations finish, allowing half a pixel of rounding), and turning the phone (resizing the viewport between portrait and landscape). TE20's date-typing helpers move here from `quick-log.spec.ts` | [W1.3](#w1-3) | Changed |
| `e2e/phone/layout.spec.ts` | TE38, TE39 | [W1.3](#w1-3), [W4.1](#w4-1) | New |
| `e2e/phone/tables.spec.ts` | TE40 | [W2.4](#w2-4) | New |
| `e2e/phone/journeys.spec.ts` | TE41, TE43, TE44 | [W2.4](#w2-4) | New |
| `e2e/phone/pipeline.spec.ts` | TE42 | [W3.3](#w3-3) | New |

<a id="pt10"></a>**PT10 Fixes from the PH4 checks** (added in PH4; ui-check at phone sizes and a check of every area file against the build found these)

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/shared/TablePhone.tsx`, `DataTable.tsx`, `tables-phone.css` | `TableFilters`: in landscape a list's filters move into the top bar's row (Layout on a phone); the deals stage filter goes under the search box in portrait | [W4.2](#w4-2) | Changed |
| `frontend/src/shared/theme/phone.css` | The summary under a title wraps in portrait and gives way in landscape, so the top bar stays one row; full-screen search covers the tab bar; form fields at 16 px (N7); date fields inside the margins; activity icons on the raised color; panels with 12 px corners | [W4.2](#w4-2) | Changed |
| `frontend/src/activities/LogActivityForm.tsx`, `shared/records-phone.css` | In its sheet, Cancel beside Log activity (Forms on a phone), and the type choice as three 44 px segments | [W4.2](#w4-2) | Changed |
| `frontend/src/account/UserMenu.tsx`, `account.css` | U13: the initials circle beside the name in the sheet, and the theme choice as one 44 px control with the chosen one ringed | [W4.2](#w4-2) | Changed |
| `frontend/src/dashboard/dashboard-phone.css` | Follow-up and activity descriptions run to two lines; panels with 14 px padding | [W4.2](#w4-2) | Changed |
| `frontend/src/test-setup.ts` | `setPhone("landscape")`, so unit tests can cover landscape | [W4.2](#w4-2) | Changed |
| `frontend/src/shared/topBarSlot.ts`, `Layout.tsx`, `TopBar.tsx`, `PageHeader.tsx` | The product owner's choice: in landscape the top bar reads title, filters, search, then the main action, through a second slot after the search button, so the order read and tabbed to is the order seen (N6). `TopBarPhone.test.tsx` checks both orientations | [W4.2](#w4-2) | Changed, one test new |
| `frontend/src/search/SearchBox.tsx` | The product owner's choice: full-screen search on a phone says "Search everything" (F8) | [W4.2](#w4-2) | Changed |
| `e2e/phone/journeys.spec.ts` | TE41, TE43 and TE44 run at every size (W4.1), and TE41 checks search covers the tab bar | [W4.1](#w4-1) | Changed |

### Docs and harness

<a id="pt9"></a>**PT9 Docs**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `docs/STATUS.md` | Each phase's notes, the by-hand results and the sign-off | Every phase | Changed |
| `docs/specs/*.md`, `docs/spec.md` | Anything the build settles that the spec doesn't say, after asking the product owner | Every phase | Changed |
| `.claude/agents/ui-check.md` | Checks phone sizes too: 390 by 844 and 844 by 390, light and AMOLED dark | [W4.2](#w4-2) | Changed |
| `docs/specs/platform.md` | Repository layout: `phone.ts`, `Sheet.tsx`, `MoreMenu.tsx`, `TabBar.tsx`, `RecordHeader.tsx` and the phone stylesheets | [W4.2](#w4-2) | Changed |

### New dependencies

None. The sheet, the stage tabs and the tab bar are small components of our own; touch dragging isn't needed, since the phone moves cards with buttons (CN26); and Playwright's Chrome emulates a phone with touch.

## Order of work

Phases run in order, and each ends with `npm run check` passing and a note in `docs/STATUS.md`. Within a phase, parts run in parallel once what they need is in place; the Needs column says what that is. Each phase ends at a commit point, and the product owner reviews it before the next starts.

### Phases

| Phase | Name | Parts | Done when |
| --- | --- | --- | --- |
| <a id="ph1"></a>PH1 | Foundations | [PT1](#pt1), [PT2](#pt2), [PT8](#pt8) | At phone sizes every page has the tab bar (the rail in landscape), the title and main action in the top bar, AMOLED dark in Dark, and no sideways scroll on the page shell; on a laptop nothing has changed and every existing test passes. |
| <a id="ph2"></a>PH2 | Tables, forms, records, search and the menu | [PT3](#pt3), [PT4](#pt4), [PT5](#pt5), [PT8](#pt8) | Every list, form, dialog, record page, the timeline, search and the user menu work on a phone with no hover; a call with a follow-up is logged from a contact found by search in under 30 seconds (SC5). |
| <a id="ph3"></a>PH3 | Pipeline and dashboard | [PT6](#pt6), [PT7](#pt7), [PT8](#pt8) | The pipeline works one stage at a time with Move to, Move up and Move down, kept after a reload; the dashboard reads in one column, and two in landscape (SC4). |
| <a id="ph4"></a>PH4 | Finish | [PT8](#pt8), [PT9](#pt9), [PT10](#pt10) | Every page passes TE38 in portrait, landscape and at 360 px, light and AMOLED dark (SC2, SC3); ui-check finds nothing broken at phone sizes or changed on a laptop (SC6); the docs match what was built; the product owner signs off on a real phone after Deploy (SC7). |

### Work items

| ID | Phase | Part | Work | Needs | Delivers | Risks | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="w1-1"></a>W1.1 | [PH1](#ph1) | [PT1](#pt1) | `phone.ts` with `PHONE_QUERY` and `usePhone()`; the `matchMedia` stand-in; AMOLED tokens and their tests; `viewport-fit=cover`. | None | CN24, CN25, M6, IC2, IC3 | [R2](#r2), [R4](#r4), [R9](#r9), [R12](#r12) | [TF34](#tf34), [TF35](#tf35) |
| <a id="w1-2"></a>W1.2 | [PH1](#ph1) | [PT2](#pt2) | Tab bar and rail, top bar slot, page header portal, `Sheet`, toasts above the tab bar, `phone.css`. | [W1.1](#w1-1) | N1, N3, N4, N6, N7, IC4, IC5 | [R1](#r1), [R4](#r4), [R7](#r7) | [TF36](#tf36), [TF37](#tf37) |
| <a id="w1-3"></a>W1.3 | [PH1](#ph1) | [PT8](#pt8) | The phone projects and helpers; TE38 and TE39 for the shell on every page. | [W1.2](#w1-2) | IC7, SC1 | [R5](#r5), [R14](#r14) | [TE38](#te38), [TE39](#te39) |
| <a id="w2-1"></a>W2.1 | [PH2](#ph2) | [PT3](#pt3) | The table's list, More menu, Sort by and paging; forms and confirm dialogs as sheets. | [PH1](#ph1) | T8, N2, N5, CN26 | [R1](#r1), [R8](#r8) | [TF38](#tf38), [TF39](#tf39) |
| <a id="w2-2"></a>W2.2 | [PH2](#ph2) | [PT4](#pt4) | Each list's `phoneRow`; record headers, Call and Email; the timeline's More menu; Log activity in a sheet. | [W2.1](#w2-1) | C7, D11, O5, A7, IC6 | [R6](#r6) | [TF40](#tf40), [TF41](#tf41) |
| <a id="w2-3"></a>W2.3 | [PH2](#ph2) | [PT5](#pt5) | Full-screen search; the user menu's sheet and the rail's circle; the sign-in panel on a phone. | [PH1](#ph1) | F8, U13 | [R7](#r7) | [TF44](#tf44), [TF45](#tf45) |
| <a id="w2-4"></a>W2.4 | [PH2](#ph2) | [PT8](#pt8) | TE40, TE41, TE43 and TE44. | [W2.1](#w2-1) to [W2.3](#w2-3) | SC4, SC5 | [R5](#r5) | [TE40](#te40), [TE41](#te41), [TE43](#te43), [TE44](#te44) |
| <a id="w3-1"></a>W3.1 | [PH3](#ph3) | [PT6](#pt6) | `moveToStage` and `moveWithin`; the stage tabs and one column; Move to, Move up and Move down through the drop's save path; no drag on a phone. | [PH2](#ph2) | P9, P10, P11 | [R3](#r3), [R10](#r10), [R11](#r11) | [TF42](#tf42), [TF43](#tf43) |
| <a id="w3-2"></a>W3.2 | [PH3](#ph3) | [PT7](#pt7) | The dashboard's phone order, chart labels, tap tooltips, list rows and tiles. | [PH2](#ph2) | H9 | [R13](#r13) | [TF46](#tf46) |
| <a id="w3-3"></a>W3.3 | [PH3](#ph3) | [PT8](#pt8) | TE42, and TE38 extended to the pipeline's sheet and the dashboard. | [W3.1](#w3-1), [W3.2](#w3-2) | SC4 | [R3](#r3) | [TE42](#te42) |
| <a id="w4-1"></a>W4.1 | [PH4](#ph4) | [PT8](#pt8) | Run every phone spec in all three projects, light and AMOLED dark; fix what they find. | [PH3](#ph3) | SC1 to SC3 | [R5](#r5), [R14](#r14) | [TE38](#te38) to [TE44](#te44) |
| <a id="w4-2"></a>W4.2 | [PH4](#ph4) | [PT9](#pt9) | `ui-check.md` at phone sizes, run it (TM21, TM22); TM23; check every area file matches what was built; the repository layout in `platform.md`. | [W4.1](#w4-1) | SC6 | [R1](#r1) | [TM21](#tm21) to [TM23](#tm23) |
| <a id="w4-3"></a>W4.3 | Deploy | [PT9](#pt9) | After the merge and Render's deploy, the product owner checks the live app on a real phone in portrait and landscape and signs off in `docs/STATUS.md`. | [W4.2](#w4-2) | SC7 | [R5](#r5) | [TM20](#tm20) |

## Risks

| ID | Risk | Effect | What we'll do | Handled in | Proven by |
| --- | --- | --- | --- | --- | --- |
| <a id="r1"></a>R1 | A phone rule leaks onto the laptop | Laptop screens change, against SC6 | Every phone rule sits inside the phone query, in stylesheets of its own; `components.css` and `global.css` don't change; the laptop end-to-end tests run unchanged at 1440 by 900; ui-check compares the laptop screens with the dark mode screenshots | [W1.2](#w1-2), [W2.1](#w2-1), [W4.2](#w4-2) | Every existing TE, [TM22](#tm22) |
| <a id="r2"></a>R2 | The stylesheets and `usePhone()` disagree about what's a phone | A page shows the phone's markup with the laptop's layout, or the other way round | One `PHONE_QUERY` constant; a test reads every stylesheet and checks each phone `@media` rule uses exactly that query | [W1.1](#w1-1) | [TF34](#tf34) |
| <a id="r3"></a>R3 | Move up or Move down with a search on lands the card in the wrong place, or a move from the sheet skips P6's ordering and rollback | Deals out of order, or a failed save that looks saved | `moveWithin` builds the same `Move` a drop does, with the hidden cards handled as P4 says, and the sheet goes through the drop's `useMoveDeal` queue | [W3.1](#w3-1) | [TF42](#tf42), [TF43](#tf43), [TE42](#te42) |
| <a id="r4"></a>R4 | The phone's own bars cover the app: the browser's address bar changes the height, and the home bar covers the tab bar | Buttons hidden or cut off at the bottom | Heights use `dvh`, the tab bar and sheets pad by `env(safe-area-inset-bottom)` with `viewport-fit=cover`, and nothing is fixed at `100vh` | [W1.1](#w1-1), [W1.2](#w1-2) | [TE38](#te38), [TM20](#tm20) |
| <a id="r5"></a>R5 | Chrome emulating a phone behaves differently from a real phone (Safari on iPhone above all) | Tests pass and the phone still has problems | The product owner's sign-off on a real phone in both orientations (SC7); fields at 16 px so Safari doesn't zoom in (N7); no hover anywhere on a phone | [W4.3](#w4-3) | [TM20](#tm20) |
| <a id="r6"></a>R6 | Logging an activity on a phone takes longer than on a laptop | SC5 missed | Log activity is one tap from a record, opens with Call chosen and the description focused, and dates use the phone's own picker | [W2.2](#w2-2) | [TE41](#te41) |
| <a id="r7"></a>R7 | A sheet traps the person: focus lost, the page scrolling under it, or no way out without a keyboard | A screen that can't be left, or that screen readers can't use | One `Sheet` component for every sheet, tested once: focus in and back, Escape, tap outside, the handle, and the page locked while it's open | [W1.2](#w1-2) | [TF37](#tf37), [TE44](#te44) |
| <a id="r8"></a>R8 | Turning the phone or resizing across the phone size loses what's typed or the table's place | N5 broken | Turning a phone keeps the phone layout, so nothing remounts; tables keep one TanStack table for both layouts; forms keep their state in the same component | [W2.1](#w2-1) | [TE43](#te43) |
| <a id="r9"></a>R9 | jsdom has no `matchMedia`, or a test left on the phone size breaks the next | Unit tests fail or depend on order | The stand-in in `test-setup.ts` resets to laptop after every test | [W1.1](#w1-1) | [TF34](#tf34), every TF |
| <a id="r10"></a>R10 | Drag sensors on a touch screen fight with scrolling the stage | Cards move when the person meant to scroll | No drag sensors on a phone; cards move only with the sheet (CN26) | [W3.1](#w3-1) | [TE42](#te42) |
| <a id="r11"></a>R11 | The chosen stage is lost on a refresh or the back button | The board jumps back to New | The stage is kept in the address, as the deals stage filter is | [W3.1](#w3-1) | [TF43](#tf43), [TE42](#te42) |
| <a id="r12"></a>R12 | AMOLED panels, lines or fields fail contrast, or a new token is missed in light mode | M5 broken on a phone | The AMOLED block is in the token tests, every text and surface pair checked; `--raised` has light and dark values | [W1.1](#w1-1) | [TF35](#tf35) |
| <a id="r13"></a>R13 | Recharts' tooltips don't open on a tap, or the charts overflow a 360 px screen | H9 broken, or sideways scroll | Charts use Recharts' responsive container at the panel's width; tooltips are tested by tapping in TE38's dashboard pass | [W3.2](#w3-2) | [TF46](#tf46), [TE38](#te38) |
| <a id="r14"></a>R14 | Three more end-to-end projects make `npm run check` slow | Slower work | The phone projects run only `e2e/phone/`, a handful of specs; CI already skips end-to-end tests | [W1.3](#w1-3), [W4.1](#w4-1) | The run time noted in `docs/STATUS.md` |

## Proof

Each test fails before its work item and passes after it. The frontend tests switch to the phone size with the `matchMedia` stand-in; the end-to-end tests use the phone projects in the installed Chrome with touch.

### Frontend unit tests (Vitest)

| ID | File in `frontend/src/` | Proves | Requirements | Risks |
| --- | --- | --- | --- | --- |
| <a id="tf34"></a>TF34 | `shared/phone.test.ts` | `usePhone()` follows the media query, changing when it does; every phone `@media` rule in every stylesheet uses `PHONE_QUERY` exactly | CN24 | [R2](#r2), [R9](#r9) |
| <a id="tf35"></a>TF35 | `shared/theme/contrast.test.ts`, `colors.test.ts` | Every AMOLED text and surface pair meets M5 against `--page`, `--panel` and `--raised`; the AMOLED block overrides only tokens the light block defines; no color outside `tokens.css` | M5, M6, CN25 | [R12](#r12) |
| <a id="tf36"></a>TF36 | `shared/TabBar.test.tsx` | Five links in order with their labels, the current one marked; the page's title and main action in the top bar; on a laptop the sidebar instead, and a window crossing the phone size swaps one for the other | N4 | None |
| <a id="tf37"></a>TF37 | `shared/Sheet.test.tsx` | A sheet is a labelled modal dialog; focus moves into it and back to what opened it; Escape, a tap outside and dragging the handle down close it; the page doesn't scroll while it's open | N6, U13 | [R7](#r7) |
| <a id="tf38"></a>TF38 | `shared/DataTable.test.tsx`, `MoreMenu.test.tsx` | On a phone: rows as a list with name, second line and end; tapping a row opens it; More opens Edit and Delete; Sort by lists the columns in both orders, sorts, and marks the current one; search, filters and paging as on a laptop; switching between phone and laptop keeps the search, sort and page | T1 to T8, N5 | [R8](#r8) |
| <a id="tf39"></a>TF39 | `shared/RecordHeader.test.tsx` | A form in a side panel starts in the field it marks (What happened in Log activity). The form and confirm sheets' layout on a phone is CSS alone, so TE40 checks it in the browser: the form full width, every control 44 px, the confirm sheet's buttons | T4, T6, A7 | [R7](#r7) |
| <a id="tf40"></a>TF40 | `shared/RecordHeader.test.tsx`, the record pages' tests | Back, More with Edit and Delete, the name, second line and status; a contact's Call and Email are `tel:` and `mailto:` links, each left out when empty; on a laptop the pages are as before | C4, C7, D9, O3, N2 | None |
| <a id="tf41"></a>TF41 | `activities/LogActivityForm.test.tsx`, `Timeline.test.tsx` | On a phone, Log activity opens the form in a sheet with Call chosen and the description focused, saves with the keyboard alone, and closes; each entry's Edit and Delete are behind More | A3, A4, A7 | [R6](#r6) |
| <a id="tf42"></a>TF42 | `pipeline/board.test.ts` | `moveToStage` puts the card at the top of the new stage; `moveWithin` moves it one visible place up or down, past hidden cards as P4's drop does, and gives nothing at the first or last place; both give the same `Move` a drop to that place gives | P4, P10 | [R3](#r3) |
| <a id="tf43"></a>TF43 | `pipeline/PipelinePhone.test.tsx` | On a phone: one stage at a time, chosen from the tabs (or the arrow keys) and kept in the address; the stage's totals; cards open their deal and can't be dragged; Move to lists the six stages with "(now)"; a move updates the totals at once, says "Moved … to …", stays on the stage, saves in order, and a failed save puts the card back with the message; Move up and Move down left out at the ends; with a search on, the tabs count what's shown and Move up goes past hidden cards | P5, P6, P9 to P11 | [R3](#r3), [R11](#r11) |
| <a id="tf44"></a>TF44 | `search/SearchBox.test.tsx` | On a phone the button opens search full screen with the box focused; results and keys as F3 to F7; choosing a result opens it and closes search; Cancel closes and clears | F8 | None |
| <a id="tf45"></a>TF45 | `account/UserMenu.test.tsx`, `account/SignInPage.test.tsx` | On a phone the menu opens in a sheet with the name, email, theme choice and Sign out, works by keyboard as U12 says, and closes on a tap outside; the sign-in screen is unchanged in what it says | U12, U13 | [R7](#r7) |
| <a id="tf46"></a>TF46 | `dashboard/DashboardPage.test.tsx` | On a phone every third month is labelled on the charts; everything on the laptop's dashboard is still there, Mark done included. Mark done's 44 px is measured by TE38 in a real browser | H1 to H9 | [R13](#r13) |

### End-to-end tests (Playwright with Chrome)

Each runs in the `phone`, `phone-landscape` and `phone-narrow` projects unless it says otherwise, with no console errors (G11).

| ID | File in `e2e/phone/` | Proves | Requirements | Risks |
| --- | --- | --- | --- | --- |
| <a id="te38"></a>TE38 | `layout.spec.ts` | Every page, every open sheet and form, and the sign-in screen: no sideways scroll on the page, and the phone not zoomed out to fit something too wide (measured against the phone's own width, since a phone's browser widens its layout to fit wide content), every visible button and link at least 44 by 44 px, fields at 16 px, in light and in Dark. PH1 checks the shell on the dashboard, the pipeline and the three record pages; the three lists join in PH2, since Chrome on a phone widens the layout to fit the laptop's table even inside a clipped panel; from PH3 every page's content too. The dashboard pass also checks H9's order (one column in portrait, two in landscape), every third month's label, and a tap opening each chart's tooltip | N1, N3, N7, SC2 | [R4](#r4), [R13](#r13) |
| <a id="te39"></a>TE39 | `layout.spec.ts` | The tab bar in portrait and the rail in landscape reach every section, with the current one marked; in Dark the page is `#000000` and panels `#0B1A1F`, and a first visit opens in it; a 1440 px window in the same test run shows the sidebar and the laptop's dark page `#04232E` | N4, M6, SC3, SC6 | [R1](#r1) |
| <a id="te40"></a>TE40 | `tables.spec.ts` | Contacts on a phone: search, the status filter, Sort by in both orders, the page controls, More then Edit saves a change, More then Delete asks in a sheet and deletes; the same list for deals and organizations | T1 to T8, C7, D11, O5 | None |
| <a id="te41"></a>TE41 | `journeys.spec.ts` | From the dashboard, search for a contact, open them, Log activity, type a call and set a follow-up date, save: done in under 30 seconds at human typing speed, and the entry shows on the dashboard (`phone` only). Chrome's phone emulation shows no date picker and takes no typed dates, so the date is set directly; picking it by hand is part of TM20 | A7, F8, SC5 | [R6](#r6) |
| <a id="te42"></a>TE42 | `pipeline.spec.ts` | Choose Negotiation from the tabs, Move a deal to Won: the totals change at once and the message says so; Move a card up and down; reload and the stage, the move and the order are kept; a card opens its deal and Back returns to the same stage | P9 to P11 | [R3](#r3), [R10](#r10), [R11](#r11) |
| <a id="te43"></a>TE43 | `journeys.spec.ts` | Half fill a contact form in portrait, turn the phone, and what was typed is still there; a contacts list scrolled and sorted keeps its sort and page after turning (`phone` only, turning to landscape and back) | N5 | [R8](#r8) |
| <a id="te44"></a>TE44 | `journeys.spec.ts` | The user menu's sheet: choose Light, close by tapping outside, reopen, sign out; the sign-in screen fits the phone and signing in returns to the page (`phone` only) | U13, M1, U4 | [R7](#r7) |

### By hand

| ID | Check | Requirements | Risks |
| --- | --- | --- | --- |
| <a id="tm20"></a>TM20 | The product owner uses the live app on Render on a real phone, in portrait and landscape, light and Dark: every section, a search, a record, Log activity with a follow-up, a form, a delete, the pipeline's Move to, the menu and sign out; and signs off how it works and how it looks in `docs/STATUS.md` | SC7, N1 to N7 | [R4](#r4), [R5](#r5) |
| <a id="tm21"></a>TM21 | ui-check at 390 by 844 and 844 by 390, every page in light and AMOLED dark, against the brand and the spec, with contrast measured on the AMOLED surfaces | M5, M6, N1, brand | [R12](#r12) |
| <a id="tm22"></a>TM22 | ui-check at 1440 by 900 in light and dark: the dashboard and pipeline match the screenshots in `docs/changes/dark-mode/`, and every page looks as before | SC6 | [R1](#r1) |
| <a id="tm23"></a>TM23 | The slowest frontend unit tests, from Vitest's report, each under a second; the end-to-end run time before and after | IC7 | [R14](#r14) |
