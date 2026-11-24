# Spec: Accountable

This spec describes Accountable as it stands today: what it does, who it's for and how it's built. It's the first thing to read before changing the product. This file is the summary of the whole product and the index; the detail lives in one file per product area in `docs/specs/`, listed under [Areas](#areas). Each change has its own intent and plan in `docs/changes/<branch name>/`, and updates this spec and the area files it touches so they keep describing the whole product.

## Problem

A small business keeps track of its customers and sales in spreadsheets, inboxes and people's heads. Nobody can see at a glance which companies we deal with, who our contacts are, what's in the sales pipeline, what happened last with a customer or what needs doing next.

## Product

Accountable is a business management system: a sales CRM that will grow into a full Business OS, including ERP. Today it's a complete sales CRM for one person, running on their own computer: a private Salesforce that does the everyday CRM essentials really well. It should feel sharp, modern and professional, and be a pleasure to use.

It has five sections:

- **Dashboard**, the landing page: how sales are going at a glance, with revenue and deals won month by month, the open pipeline and its expected revenue, a sales funnel, recent activity and the follow-ups coming up or overdue.
- **Organizations**: the companies we do business with, each with its contacts and deals.
- **Contacts**: the people we deal with, leads and customers included, each with their organization and a timeline of everything that has happened with them.
- **Deals**: the potential sales, with their stage, value and close date, and a timeline each.
- **Pipeline**: the deals as cards on a board, one column per stage. Dragging a card changes its stage or its place, and dragging into Won or Lost closes the deal.

Every page can be shown in dark mode, the default, or light mode. A switch at the bottom of the sidebar changes it, and the app remembers the choice.

### Users

- One salesperson, using Accountable on their own computer every day. The rest of the sales team joins later.
- The salesperson isn't technical: comfortable with web apps and spreadsheets, but not the terminal. Setup steps are written plainly, and error messages are clear and friendly.
- No other systems are involved yet.

### Goals

Accountable is working when:

- The salesperson stops keeping customer and sales data in spreadsheets or anywhere else.
- The pipeline's value, a customer's last contact and today's follow-ups are each one click from the dashboard.
- Logging a call with a follow-up takes under 30 seconds.
- The code is a clean base for adding the team, Supabase and ERP later.

## Areas

Each area file holds that area's concerns, requirements and design (data model, API and screens, where it has them).

| Area file | What it covers |
| --- | --- |
| [platform.md](specs/platform.md) | running the app, offline use, saving, migrations, money and dates, errors, sample data, architecture, repository layout, libraries, data model conventions and indexes, API conventions, testing |
| [look-and-feel.md](specs/look-and-feel.md) | light and dark mode, the page layout, dark mode surfaces, page header, record pages, brand fonts, colors, stage colors, things to avoid, copy |
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
| S1 to S4 | Sample data | [platform.md](specs/platform.md#sample-data) |
| M1 to M5 | Light and dark mode | [look-and-feel.md](specs/look-and-feel.md#light-and-dark-mode) |
| T1 to T7 | Tables (organizations, contacts and deals) | [tables-and-forms.md](specs/tables-and-forms.md#tables-organizations-contacts-and-deals) |
| V1 to V5 | Validation | [tables-and-forms.md](specs/tables-and-forms.md#validation) |
| O1 to O4 | Organizations | [organizations.md](specs/organizations.md#organizations) |
| C1 to C6 | Contacts | [contacts.md](specs/contacts.md#contacts) |
| D1 to D10 | Deals | [deals.md](specs/deals.md#deals) |
| P1 to P8 | Pipeline | [pipeline.md](specs/pipeline.md#pipeline) |
| A1 to A6 | Activities and follow-ups | [activities.md](specs/activities.md#activities-and-follow-ups) |
| H1 to H8 | Dashboard | [dashboard.md](specs/dashboard.md#dashboard) |

### Concerns

Questions settled while the product was designed. They're numbered because requirements, tests and code refer to them. Each lives in the area file it's about.

| Concern | Area file |
| --- | --- |
| 1. A deal's organization is required, but deleting an organization leaves deals with none. | [deals.md](specs/deals.md#concerns) |
| 2. Six pipeline stages, five brand colors. | [look-and-feel.md](specs/look-and-feel.md#concerns) |
| 3. Two brand pairings fail contrast for small text. | [look-and-feel.md](specs/look-and-feel.md#concerns) |
| 4. Offline use and Google Fonts. | [platform.md](specs/platform.md#concerns) |
| 5. A non-technical user and a terminal command. | [platform.md](specs/platform.md#concerns) |
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

### Design

| Design section | Area file |
| --- | --- |
| Architecture | [platform.md](specs/platform.md#architecture); the dashboard's part in [dashboard.md](specs/dashboard.md#architecture), light and dark mode's in [look-and-feel.md](specs/look-and-feel.md#architecture) |
| Repository layout, Libraries, Testing | [platform.md](specs/platform.md#repository-layout) |
| Data model | conventions and indexes in [platform.md](specs/platform.md#data-model); each table in its area file |
| API | conventions, errors, the `X-Local-Date` header and `GET /health` in [platform.md](specs/platform.md#api); each section's endpoints in its area file |
| Screens | the shared layout, page header and record pages in [look-and-feel.md](specs/look-and-feel.md#screens); tables and forms in [tables-and-forms.md](specs/tables-and-forms.md#screens); the timeline, pipeline and dashboard in their area files |
| Brand: fonts, Colors, Stage colors, things to avoid, copy | [look-and-feel.md](specs/look-and-feel.md#brand) |

## Not in Accountable yet

Sign-in, user accounts and several users; a record of who did what; access from beyond the computer it runs on; following the computer's own dark mode setting; phone layouts; AI features; email, calendar and phone integrations; currencies other than US dollars; reports beyond the dashboard; tags and custom fields; changing the pipeline stages; and import or export.

## Roadmap

- **The team:** sign-in, several people sharing the same data, and a record of who did what.
- **Beyond one computer:** making Accountable available to people elsewhere, not only on the computer it runs on.
- **ERP:** new sections such as invoices, each as its own backend module and frontend folder (see [Repository layout](specs/platform.md#repository-layout)).
