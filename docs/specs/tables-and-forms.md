# Spec: Tables and forms

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers what the organizations, contacts and deals tables share, on a laptop and on a phone, the side-panel forms and how form input is checked. Each table's own columns and fields are in its area file.

## Requirements

### Tables (organizations, contacts and deals)

- **T1** Each table has a search box that filters as you type, across the columns listed for that table.
- **T2** Clicking a column heading sorts by it; clicking again reverses the order. The current sort shows an arrow. Empty values sort last in both directions.
- **T3** Tables show 25 rows a page, with page controls and a count such as "Showing 26 to 50 of 412". Searching goes back to the first page.
- **T4** Each table has an "Add" button that opens a form in a side panel.
- **T5** Each row has Edit and Delete actions. Clicking the row itself opens the record's page.
- **T6** Delete asks for confirmation in a dialog that names the record and says what happens to linked records, using the counts, for example "Acme Ltd has 4 contacts and 2 deals. They'll be kept, with no organization."
- **T7** An empty table, or a search with no results, shows a short message and, for an empty table, the Add button.
- **T8** On a phone, each table shows its rows as a list: the name, a second line, and on the right a status, stage or amount, then a More button holding Edit and Delete (Concern 26 in [look-and-feel.md](look-and-feel.md#concerns)). Tapping the row opens the record. The search box, filters and paging work as on a laptop, and a "Sort by" button opens a sheet listing the table's columns, each in either order, with the current sort marked. Each table's list is in its area file.

### Validation

- **V1** Required fields: organization name; contact name; deal name, organization, stage and value; activity type, description and date.
- **V2** An email address or website is checked for the right format when it's filled in. A website without `https://` is accepted and saved with it added.
- **V3** Errors show under the field in plain words, such as "Enter an email address like name@company.com". The form keeps what was typed.
- **V4** The backend checks the same rules and returns friendly messages per field, so the frontend never relies on its own checks alone.
- **V5** Text has a size limit: names, email addresses and websites up to 200 characters, other text (notes, descriptions) up to 10,000. Over the limit, the message is "Keep this to 200 characters or fewer." (or 10,000). An email address's length is checked before its format.

## Design

### Screens

**Tables.** A panel with the search box and filters above the rows. Rows are 48 px high, with a light hover tint and the Edit and Delete icons shown on hover and on keyboard focus. Numbers and money are right-aligned in JetBrains Mono.

**Forms.** A side panel slides in from the right, 480 px wide, with fields stacked in one column, labels above fields and required fields marked. Save is the primary button; Cancel and Escape close it. Enter in the last field saves.

**Tables on a phone (T8).** The search box fills the width above the list, with the filters under it as pills that scroll sideways when they don't fit, and the "Sort by" button at the right of the search box. Each row is at least 56 px high: the name in 14 px semibold, the second line in 13 px secondary text, and on the right the row's status pill, stage or amount, then the More button. Rows are set apart by space and a faint line, not by panels of their own. Paging sits under the list: "26 to 50 of 412" between Previous and Next buttons. In landscape the list runs in two columns.

**Forms on a phone.** The side panel opens full screen, rising from the bottom, with the form's title and a close button in its header. Fields keep their order and labels, and fill the width. Cancel and Save sit side by side at the bottom, above the phone's keyboard when it's open, with Save on Sea Green. Dates and dropdowns, such as a deal's organization, are the browser's own, so the phone shows its own pickers. The activity type stays a three-way choice.

**Confirm dialogs on a phone.** A sheet rises from the bottom with the same message as on a laptop (T6), and the two buttons full width, one above the other, the danger button on top.
