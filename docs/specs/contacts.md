# Spec: Contacts

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers the people we deal with, leads and customers included: their fields, table, status filter, record page and what deleting one does. The timeline on a contact's page is in [activities.md](activities.md).

## Requirements

### Contacts

- **C1** Fields: name (required), email, phone, job title, organization, status (lead, qualified or customer; new contacts default to lead).
- **C2** Table columns: name, organization, job title, email, phone, status, last activity date. Search covers name, email, phone, job title and organization name.
- **C3** The table has a status filter with All, Lead, Qualified and Customer, and counts on each.
- **C4** The contact page shows their details, their organization, the deals where they're the main contact, and their timeline.
- **C5** The timeline holds the contact's own activities plus the activities and stage changes of deals where they're the main contact, newest first. Entries from a deal name the deal.
- **C6** Deleting a contact keeps their deals, which are left with no main contact. Activities logged on the contact are deleted.

## Design

### Data model

**contacts**

| Column | Type | Notes |
| --- | --- | --- |
| name | text | required |
| email, phone, job_title | text | optional |
| organization_id | int | optional, `ON DELETE SET NULL` |
| status | text | `lead`, `qualified` or `customer` |

### API

| Method and path | Purpose |
| --- | --- |
| `GET /contacts?status=` | list with organization name and last activity date |
| `POST /contacts`, `GET/PATCH/DELETE /contacts/{id}` | create, read, update, delete; read includes organization and deals |
| `GET /contacts/{id}/delete-impact` | counts used by the confirm dialog |

The contact's timeline endpoint is in [activities.md](activities.md#api).
