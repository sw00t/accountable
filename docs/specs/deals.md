# Spec: Deals

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers the potential sales: their fields, the rules that run when a deal changes stage, the table, the record page and what deleting one does. The board is in [pipeline.md](pipeline.md), and the timeline on a deal's page is in [activities.md](activities.md).

## Concerns

- **Concern 1: A deal's organization is required, but deleting an organization leaves deals with none.** The organization is required when a deal is created, and when it's edited unless it's already empty. A deal with no organization shows "No organization" and a quiet prompt to pick one.
- **Concern 7: Won deals by month depends on an editable date.** A deal counts as won in the month of its close date. A Won or Lost deal's close date can't be in the future, so the charts can't show wins that haven't happened.

## Requirements

### Deals

- **D1** Fields: name (required), organization (required, see Concern 1), main contact, stage (required, default New), value (required, whole dollars, 0 to 1,000,000,000), probability of close (0 to 100), close date.
- **D2** The main contact list offers the contacts of the chosen organization first, then everyone else.
- **D3** Each stage has a usual probability: New 10%, Qualified 25%, Proposal 50%, Negotiation 75%, Won 100%, Lost 0%. A new deal takes its stage's probability, unless a probability is typed in when it's added. When the stage changes, the probability is reset to the new stage's, unless the same edit also types in a new probability, which then wins. A probability set by hand stays until the next stage change.
- **D4** When a deal moves to Won or Lost, its close date becomes today, unless the same edit types in a different close date, which then wins. It can be edited afterwards, but not to a date after today (Concern 7). A Won or Lost deal always has a close date: if it's left empty, today is used.
- **D5** When a deal moves to Won, its main contact's status becomes customer if it isn't already. A status is never lowered automatically, including when a deal moves out of Won.
- **D6** Every stage change, whether from the form or the board, records an entry with the old stage, the new stage and the time. It appears in the deal's timeline as "Moved from Proposal to Negotiation" and in the dashboard's recent activity.
- **D7** A deal is late when it's open (not Won or Lost) and its close date is before today. Late deals show a Raspberry "Late" badge in the table and on their card.
- **D8** Table columns: name, organization, main contact, stage, value, probability, expected revenue (value times probability), close date. Search covers name, organization and main contact. The table has a stage filter.
- **D9** The deal page shows its details, its organization and main contact, and its timeline of activities and stage changes, newest first.
- **D10** Deleting a deal deletes its activities and stage changes.
- **D11** On a phone, the deals list (T8) shows each deal's name, its organization and stage as the second line ("Garcia Freight · Proposal"), and its value, with the Late badge after the name when it applies. The stage filter sits above the list as on a laptop.

## Design

### Data model

**deals**

| Column | Type | Notes |
| --- | --- | --- |
| name | text | required |
| organization_id | int | `ON DELETE SET NULL`, required by the API on create |
| contact_id | int | main contact, optional, `ON DELETE SET NULL` |
| stage | text | `new`, `qualified`, `proposal`, `negotiation`, `won`, `lost` |
| value | int | whole US dollars, 0 to 1,000,000,000 |
| probability | int | 0 to 100 |
| close_date | date | optional |
| position | float | order within the stage's column, lower is higher up |
| search_name | text | the name in lower case, for search ([search.md](search.md#data-model)) |
| created_by, updated_by | int | who added it and who last changed it, `ON DELETE SET NULL`, null for the sample data ([accounts.md](accounts.md#data-model)) |

How `position` is set is under Card order in [pipeline.md](pipeline.md#data-model).

**stage_changes**

| Column | Type | Notes |
| --- | --- | --- |
| deal_id | int | `ON DELETE CASCADE` |
| from_stage | text | null for the deal's first stage |
| to_stage | text | |
| changed_at | timestamp | |

### API

| Method and path | Purpose |
| --- | --- |
| `GET /deals?stage=` | list with organization, contact and expected revenue |
| `POST /deals`, `GET/PATCH/DELETE /deals/{id}` | create, read, update, delete; PATCH applies D3 to D6 |
| `GET /deals/{id}/delete-impact` | counts used by the confirm dialog |

Reading a deal includes who added it and who last changed it (U10). Moving a deal on the board (`POST /deals/{id}/move`) is in [pipeline.md](pipeline.md#api), and the deal's timeline endpoint is in [activities.md](activities.md#api).
