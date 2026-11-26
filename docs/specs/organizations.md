# Spec: Organizations

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers the companies we do business with: their fields, table, record page and what deleting one does.

## Requirements

### Organizations

- **O1** Fields: name (required), website, industry, notes.
- **O2** Table columns: name, industry, website, number of contacts, number of open deals, open pipeline value. Search covers name, industry and website.
- **O3** The organization page shows its details, its contacts and its deals, each with a link to the record and a way to add a new contact or deal already linked to it.
- **O4** Deleting an organization keeps its contacts and deals, which are left with no organization. Their activities stay.
- **O5** On a phone, the organizations list (T8) shows each organization's name, its industry as the second line, and its open pipeline value.

## Design

### Data model

**organizations**

| Column | Type | Notes |
| --- | --- | --- |
| name | text | required |
| website | text | optional, normalized to start with `https://` |
| industry | text | optional, free text with suggestions from existing values |
| notes | text | optional |
| search_name | text | the name in lower case, for search ([search.md](search.md#data-model)) |
| created_by, updated_by | int | who added it and who last changed it, `ON DELETE SET NULL`, null for the sample data ([accounts.md](accounts.md#data-model)) |

### API

| Method and path | Purpose |
| --- | --- |
| `GET /organizations` | list with contact count, open deal count and open value |
| `POST /organizations`, `GET/PATCH/DELETE /organizations/{id}` | create, read with contacts and deals, update, delete |
| `GET /organizations/{id}/delete-impact` | counts used by the confirm dialog |

Reading an organization includes who added it and who last changed it (U10).
