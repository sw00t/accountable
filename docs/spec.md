# Spec: Accountable

This spec describes Accountable as it stands today: what it does, who it's for and how it's built. It's the first thing to read before changing the product. This file is the summary of the whole product and the index; the detail lives in one file per product area in `docs/specs/`, listed under [Areas](#areas). Each change has its own intent and plan in `docs/changes/<branch name>/`, and updates this spec and the area files it touches so they keep describing the whole product.

## Problem

A small business keeps track of its customers and sales in spreadsheets, inboxes and people's heads. Nobody can see at a glance which companies we deal with, who our contacts are, what's in the sales pipeline, what happened last with a customer or what needs doing next.

## Product

Accountable is a business management system: a sales CRM that will grow into a full Business OS, including ERP. Today it's a complete sales CRM for a small team, shared on the web: a private Salesforce that does the everyday CRM essentials really well. It should feel sharp, modern and professional, and be a pleasure to use.

Everyone signs in with their own email and password and works on the same data, and each record shows who added it. People are added by whoever runs Accountable for the team, in Supabase's dashboard; there's no sign-up page.

It has five sections:

- **Dashboard**, the landing page: how sales are going at a glance, with revenue and deals won month by month, the open pipeline and its expected revenue, a sales funnel, recent activity and the follow-ups coming up or overdue.
- **Organizations**: the companies we do business with, each with its contacts and deals.
- **Contacts**: the people we deal with, leads and customers included, each with their organization and a timeline of everything that has happened with them.
- **Deals**: the potential sales, with their stage, value and close date, and a timeline each.
- **Pipeline**: the deals as cards on a board, one column per stage. Dragging a card changes its stage or its place, and dragging into Won or Lost closes the deal.

A top bar on every page has a search box that finds any organization, contact or deal by part of its name, and a menu under your initials with the theme and signing out. The theme is Dark (the default), Light or System, which follows the device's setting, and the browser remembers the choice.

Accountable works on a phone too, in its browser at the same address, in portrait and landscape. Everything that can be done on a laptop can be done on a phone: the sections sit in a tab bar at the bottom (a rail on the left in landscape), tables become lists, forms open full screen, and the pipeline shows one stage at a time, with a "Move to" button on each card in place of dragging. On a phone, Dark is AMOLED dark, with a true black page.

### Users

- A small sales team sharing one Accountable on the web, each person signed in as themselves. Everyone can see and change everything.
- The team isn't technical: comfortable with web apps and spreadsheets, but not the terminal. They open Accountable at its web address and install nothing. Setup steps are written plainly, and error messages are clear and friendly.
- Whoever runs Accountable for the team adds people in Supabase's dashboard and deploys it to Render, following the steps in `docs/STATUS.md`.
- Accountable keeps its data and its sign-in in Supabase and runs on Render. No other systems are involved.

### Goals

Accountable is working when:

- The team stops keeping customer and sales data in spreadsheets or anywhere else.
- The pipeline's value, a customer's last contact and today's follow-ups are each one click from the dashboard.
- Any organization, contact or deal is one search away from any page.
- Logging a call with a follow-up takes under 30 seconds.
- The code is a clean base for adding roles, a full record of who did what, and ERP later.

## Areas

Each area file holds that area's concerns, requirements and design (data model, API and screens, where it has them).

| Area file | What it covers |
| --- | --- |
| [platform.md](specs/platform.md) | running the app, offline use, saving, the two databases, migrations, money and dates, errors, sample data, running on the web and Render, settings, architecture, repository layout, libraries, data model conventions and indexes, API conventions, testing |
| [accounts.md](specs/accounts.md) | signing in and out, local sign-in for development and tests, sessions, who added and last changed each record, the user menu; the `users` table, the token check and its endpoints; the sign-in screen and the menu |
| [search.md](specs/search.md) | the top bar's search for organizations, contacts and deals; ignoring case on both databases; its endpoint and screen |
| [look-and-feel.md](specs/look-and-feel.md) | light, dark and System themes, AMOLED dark on phones, the page layout with its top bar, the phone layout with its tab bar, dark mode surfaces, page header, record pages, brand fonts, colors, stage colors, things to avoid, copy |
| [tables-and-forms.md](specs/tables-and-forms.md) | what the organizations, contacts and deals tables share, the side-panel forms, validation |
| [organizations.md](specs/organizations.md) | organizations: fields, table, record page, deleting; the `organizations` table and its endpoints |
| [contacts.md](specs/contacts.md) | contacts: fields, table, status filter, record page, deleting; the `contacts` table and its endpoints |
| [deals.md](specs/deals.md) | deals: fields, stage rules, late deals, table, record page, deleting; the `deals` and `stage_changes` tables and their endpoints |
| [pipeline.md](specs/pipeline.md) | the board: columns, cards, dragging, totals, card order; the move endpoint and the board's screen |
| [activities.md](specs/activities.md) | activities, follow-ups and timelines; the `activities` table, the activity and timeline endpoints and the timeline's screen |
| [dashboard.md](specs/dashboard.md) | the dashboard: headline figures, charts, pipeline visual, funnel, recent activity, follow-ups; its endpoint and screen |

### Requirements

Each requirement has an ID so tests, code and status notes can refer to it.

| IDs | Requirements | Area file |
| --- | --- | --- |
| G1 to G12 | General | [platform.md](specs/platform.md#general) |
| G13 to G16 | Running it on the web | [platform.md](specs/platform.md#running-it-on-the-web) |
| S1 to S4 | Sample data | [platform.md](specs/platform.md#sample-data) |
| U1 to U7 | Signing in | [accounts.md](specs/accounts.md#signing-in) |
| U8 to U10 | Who added what | [accounts.md](specs/accounts.md#who-added-what) |
| U11 to U13 | User menu | [accounts.md](specs/accounts.md#user-menu) |
| F1 to F8 | Search | [search.md](specs/search.md#search) |
| M1 to M6 | Light and dark mode | [look-and-feel.md](specs/look-and-feel.md#light-and-dark-mode) |
| N1 to N7 | Phones | [look-and-feel.md](specs/look-and-feel.md#phones) |
| T1 to T8 | Tables (organizations, contacts and deals) | [tables-and-forms.md](specs/tables-and-forms.md#tables-organizations-contacts-and-deals) |
| V1 to V5 | Validation | [tables-and-forms.md](specs/tables-and-forms.md#validation) |
| O1 to O5 | Organizations | [organizations.md](specs/organizations.md#organizations) |
| C1 to C7 | Contacts | [contacts.md](specs/contacts.md#contacts) |
| D1 to D11 | Deals | [deals.md](specs/deals.md#deals) |
| P1 to P11 | Pipeline | [pipeline.md](specs/pipeline.md#pipeline) |
| A1 to A7 | Activities and follow-ups | [activities.md](specs/activities.md#activities-and-follow-ups) |
| H1 to H9 | Dashboard | [dashboard.md](specs/dashboard.md#dashboard) |

### Concerns

Questions settled while the product was designed. They're numbered because requirements, tests and code refer to them. Each lives in the area file it's about.

| Concern | Area file |
| --- | --- |
| 1. A deal's organization is required, but deleting an organization leaves deals with none. | [deals.md](specs/deals.md#concerns) |
| 2. Six pipeline stages, five brand colors. | [look-and-feel.md](specs/look-and-feel.md#concerns) |
| 3. Two brand pairings fail contrast for small text. | [look-and-feel.md](specs/look-and-feel.md#concerns) |
| 4. Offline use and Google Fonts. | [platform.md](specs/platform.md#concerns) |
| 5. A non-technical team and a terminal command. | [platform.md](specs/platform.md#concerns) |
| 6. How much value reaches each stage. | [dashboard.md](specs/dashboard.md#concerns) |
| 7. Won deals by month depends on an editable date. | [deals.md](specs/deals.md#concerns) |
| 8. A deal activity's place on a contact's timeline is derived, not stored. | [activities.md](specs/activities.md#concerns) |
| 9. What deletes take with them. | [activities.md](specs/activities.md#concerns) |
| 10. The window for "upcoming" follow-ups. | [activities.md](specs/activities.md#concerns) |
| 11. The sample data dates. | [platform.md](specs/platform.md#concerns) |
| 12. Where the light or dark choice is kept. | [look-and-feel.md](specs/look-and-feel.md#concerns) |
| 13. Text shades and fills split in dark mode. | [look-and-feel.md](specs/look-and-feel.md#concerns) |
| 14. The stage scale on a dark background. | [look-and-feel.md](specs/look-and-feel.md#concerns) |
| 15. Midnight does two jobs. | [look-and-feel.md](specs/look-and-feel.md#concerns) |
| 16. Two ways to sign in. | [accounts.md](specs/accounts.md#concerns) |
| 17. Where names come from. | [accounts.md](specs/accounts.md#concerns) |
| 18. Records nobody signed in to add. | [accounts.md](specs/accounts.md#concerns) |
| 19. A session that ends while someone is working. | [accounts.md](specs/accounts.md#concerns) |
| 20. Ignoring case the same way on SQLite and Postgres. | [search.md](specs/search.md#concerns) |
| 21. Supabase's Data API and the publishable key. | [platform.md](specs/platform.md#concerns) |
| 22. Render's free plan sleeps. | [platform.md](specs/platform.md#concerns) |
| 23. Reaching Supabase from Render. | [platform.md](specs/platform.md#concerns) |
| 24. What counts as a phone. | [look-and-feel.md](specs/look-and-feel.md#concerns) |
| 25. AMOLED dark and the brand's dark surfaces. | [look-and-feel.md](specs/look-and-feel.md#concerns) |
| 26. No hover and no dragging on a phone. | [look-and-feel.md](specs/look-and-feel.md#concerns) |

### Design

| Design section | Area file |
| --- | --- |
| Architecture | [platform.md](specs/platform.md#architecture); the dashboard's part in [dashboard.md](specs/dashboard.md#architecture), light and dark mode's in [look-and-feel.md](specs/look-and-feel.md#architecture) |
| Repository layout, Libraries, Testing | [platform.md](specs/platform.md#repository-layout) |
| Deployment | [platform.md](specs/platform.md#deployment) |
| Data model | conventions and indexes in [platform.md](specs/platform.md#data-model); each table in its area file; who added and last changed each record in [accounts.md](specs/accounts.md#data-model) |
| API | conventions, errors, the `Authorization` and `X-Local-Date` headers and `GET /health` in [platform.md](specs/platform.md#api); checking tokens in [accounts.md](specs/accounts.md#api); each section's endpoints in its area file |
| Screens | the shared layout with its top bar, page header and record pages, on a laptop and a phone, in [look-and-feel.md](specs/look-and-feel.md#screens); sign-in and the user menu in [accounts.md](specs/accounts.md#screens); the search box in [search.md](specs/search.md#screens); tables and forms in [tables-and-forms.md](specs/tables-and-forms.md#screens); the timeline, pipeline and dashboard in their area files |
| Brand: fonts, Colors, Stage colors, things to avoid, copy | [look-and-feel.md](specs/look-and-feel.md#brand) |

## Not in Accountable yet

Roles and permissions; signing up in the app, resetting a password, and signing in with Google or a magic link; a full record of who did what (each record keeps only who added it and who last changed it, and stage changes don't record who made them); moving data from a local SQLite file to Supabase; installing Accountable on a phone's home screen, using it offline, and layouts made for tablets; AI features; email, calendar and phone integrations; currencies other than US dollars; reports beyond the dashboard; tags and custom fields; changing the pipeline stages; and import or export.

## Roadmap

- **Roles and history:** roles and permissions, and a full record of who did what.
- **ERP:** new sections such as invoices, each as its own backend module and frontend folder (see [Repository layout](specs/platform.md#repository-layout)).
