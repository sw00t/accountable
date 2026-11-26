# Spec: Activities and follow-ups

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers activities (notes, calls and emails), follow-ups, and the timelines on contact and deal pages. The follow-ups panel on the dashboard is in [dashboard.md](dashboard.md).

## Concerns

- **Concern 8: A deal activity's place on a contact's timeline is derived, not stored.** If a deal's main contact changes, its activities and stage changes move to the new contact's timeline. This keeps the data simple and matches "where they're the main contact".
- **Concern 9: What deletes take with them.** Deleting a contact removes the activities logged on them, and deleting a deal removes its activities and stage changes.
- **Concern 10: The window for "upcoming" follow-ups.** Overdue means a follow-up date before today, and upcoming means today or the next 7 days. Later follow-ups appear on the timelines but not on the dashboard.

## Requirements

### Activities and follow-ups

- **A1** Fields: type (note, call or email; required), description (required), date it happened (required, default today), follow-up date (optional), done (only when there's a follow-up date).
- **A2** An activity belongs to exactly one contact or one deal.
- **A3** The contact and deal pages have a "Log activity" form at the top of the timeline. Type, description and an optional follow-up date can be filled in and saved with the keyboard alone, so logging a call with a follow-up takes under 30 seconds.
- **A4** Activities can be edited and deleted from the timeline. Deleting asks first.
- **A5** An activity logged on a deal also appears on the timeline of the deal's main contact (C5).
- **A6** A follow-up that isn't done shows on the dashboard: overdue if its date is before today, upcoming if it's today or within 7 days (Concern 10). Each has a "Mark done" button, and done follow-ups leave the list.
- **A7** On a phone, the record page's "Log activity" button (see Record pages in [look-and-feel.md](look-and-feel.md#screens)) opens A3's form full screen, with the type chosen as Call. Saving closes it and the new entry is at the top of the timeline. Logging a call with a follow-up still takes under 30 seconds. Each timeline entry's Edit and Delete sit behind its More button (Concern 26 in [look-and-feel.md](look-and-feel.md#concerns)).

## Design

### Data model

**activities**

| Column | Type | Notes |
| --- | --- | --- |
| type | text | `note`, `call` or `email` |
| description | text | required |
| occurred_on | date | required |
| contact_id | int | `ON DELETE CASCADE` |
| deal_id | int | `ON DELETE CASCADE` |
| follow_up_on | date | optional |
| done | bool | false by default |
| created_by, updated_by | int | who added it and who last changed it, `ON DELETE SET NULL`, null for the sample data ([accounts.md](accounts.md#data-model)) |

A check constraint makes exactly one of `contact_id` and `deal_id` set.

### API

| Method and path | Purpose |
| --- | --- |
| `GET /contacts/{id}/timeline` | activities and stage changes per C5, newest first |
| `GET /deals/{id}/timeline` | the deal's activities and stage changes, newest first (D9) |
| `POST /activities`, `PATCH/DELETE /activities/{id}` | create, edit, delete, mark done |

Each activity on a timeline includes who added it (U10).

### Screens

**Timeline.** A vertical list with a small icon per type (note, call, email, stage change), the description, the date, who added it (for activities), and for deal entries on a contact the deal name as a link. Follow-ups show a date chip: Raspberry when overdue, Cerulean when upcoming, grey with a check when done.
