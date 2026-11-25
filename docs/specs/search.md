# Spec: Search

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers the search box in the top bar, which finds any organization, contact or deal from any page. Each table's own search box is in [tables-and-forms.md](tables-and-forms.md) (T1).

## Concerns

- **Concern 20: Ignoring case the same way on SQLite and Postgres.** SQLite's `LIKE` ignores case only for the letters A to Z, and its `lower()` changes only those, while Postgres's `LIKE` doesn't ignore case at all. Searching "élan" would find "Élan Studio" on one and not the other. So the backend keeps a search copy of each organization, contact and deal name, in lower case as Python makes it, and compares it with the typed text made lower case the same way. Both databases then compare plain lower-case text, which they do alike, and the tests on SQLite prove what Postgres does.

## Requirements

### Search

- **F1** A search box sits in the top bar on every page, with the placeholder "Search organizations, contacts and deals".
- **F2** It finds every organization, contact and deal whose name contains the typed text anywhere, ignoring case for every letter, accented ones included (Concern 20). Spaces at either end are ignored, and characters such as `%` and `_` match only themselves.
- **F3** Results appear under the box as soon as one character is typed, and update as typing goes on. They're in three groups, Organizations, Contacts and Deals, with up to 5 in each: names that start with the text first, then the rest, each alphabetically. A group with more says how many more, such as "7 more contacts. Type more of the name to narrow it down." Groups with no results are left out.
- **F4** Each result shows its name, with the matching part in bold, and a second line: an organization's industry, a contact's organization, or a deal's organization and stage. Clicking it, or pressing Enter when it's highlighted, opens the record and clears the box.
- **F5** The Down and Up arrow keys move through the results, and Escape closes them. With nothing found, the box says "No organizations, contacts or deals match "xyz"."
- **F6** Screen readers announce the box as a search with a list of suggestions, the number of results, and the highlighted result.
- **F7** Results appear within 200 ms of typing pausing, at the sizes in G7. The frontend sends at most one request per pause, and a reply to older text never replaces newer results.

## Design

### Data model

Organizations, contacts and deals each have a `search_name` column (text, required): the name in lower case as Python's `casefold()` makes it, set by the backend whenever the name is saved, and filled for existing rows by the migration that adds it. On Postgres the column has the "C" collation, so it compares and sorts by byte order, as SQLite does, and F3's alphabetical order is the same on both.

### API

| Method and path | Purpose |
| --- | --- |
| `GET /search?q=` | up to 5 organizations, contacts and deals matching F2, ordered as F3, with how many each group has in all |

### Screens

**Search box.** On the left of the top bar, 400 px wide, on the panel color with a Lucide search icon inside its left edge. The results open under it in a panel 480 px wide with 12 px rounded corners and the usual shadow. Each group has its name as a 13 px label in secondary text, and each result has its section's sidebar icon, the name in 14 px and the second line in 13 px secondary text. The highlighted result has the hover tint. With many matches the panel's height is capped, and it scrolls inside.

A deal's second line is its organization and stage separated by a middle dot ("Garcia Freight · Proposal"), or only the stage when it has no organization. An organization with no industry, or a contact with no organization, has no second line.

Nothing is highlighted until an arrow key is pressed. Down and Up wrap around the list, Up with nothing highlighted goes to the last result, and Down opens the results again after Escape. Enter with nothing highlighted does nothing. Escape closes the results and keeps the typed text. Going to another page, through a sidebar link, the back button or any other way, clears the box and closes the results; a change only to the address's query, such as a table filter, doesn't count as another page. Moving focus away from the box closes the results, and focusing it again opens them.

When a search fails, the results panel says "Couldn't search." followed by the usual detail (G8). For screen readers (F6), a hidden status reads the total number of matches as "N results", or the no-results text, and each group is named.
