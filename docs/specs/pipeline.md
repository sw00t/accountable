# Spec: Pipeline

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers the board: the deals as cards, one column per stage, and dragging them to change stage or order, or on a phone one stage at a time with "Move to". The rules a stage change follows are in [deals.md](deals.md), and the stage colors in [look-and-feel.md](look-and-feel.md#stage-colors).

## Requirements

### Pipeline

- **P1** The board has six columns in order: New, Qualified, Proposal, Negotiation, Won, Lost.
- **P2** Each card shows the deal name, organization, main contact, value, close date and the Late badge when it applies. Open deals show their probability as a ring (see [Screens](#screens)). Clicking a card opens the deal.
- **P3** Dragging a card to another column changes the deal's stage, following D3 to D6. Dragging into Won or Lost closes the deal.
- **P4** A card can be dropped anywhere in a column, including higher or lower in its own column, and stays exactly there after a refresh. With a search on, a card dropped below a visible card goes directly under it, ahead of any cards the search hides.
- **P5** Each column header shows its stage, number of deals, total value and expected revenue. The board header shows the total value and expected revenue of open deals only.
- **P6** All totals update the moment a card is dropped, before the server replies. If the save fails, the card goes back and a friendly message says so. Moves are saved one after another, in the order the cards were dropped.
- **P7** Each column has an "Add deal" button that opens the deal form with that stage chosen. The new deal goes at the top of the column.
- **P8** Dragging works with a mouse and with the keyboard.
- **P9** On a phone, the board shows one stage at a time. A row of stage tabs across the top, one per stage in P1's order, each with its color dot, name and count, chooses the stage; the row scrolls sideways and keeps the chosen tab in view. Under the tabs, the stage's total and expected revenue (P5), then its cards in order, then its "Add deal" button (P7). The board header's open totals sit under the page title. The chosen stage is kept in the address, so a refresh or the back button returns to it.
- **P10** On a phone, each card has a "Move to" button that opens a sheet titled with the deal's name, listing the six stages with the current one marked. Choosing another stage moves the deal there, at the top of that stage, following D3 to D6 as a drag does (P3). The same sheet has "Move up" and "Move down", which move the card one place within its stage (P4); each is left out when the card is already first or last. With a search on, they move it past the next visible card, as P4's drop does.
- **P11** A move made from the sheet behaves as a drop does: totals update at once, a failed save puts the card back with a friendly message, and moves are saved in order (P6). After a move to another stage, the board stays on the stage the card left, and a short message says where it went, such as "Moved Mobile app to Won".

## Design

### Data model

The deals table, with its `position` column, is in [deals.md](deals.md#data-model).

**Card order.** Dropping a card between two others sets its `position` to the midpoint of theirs; at the top or bottom it's one less than the first or one more than the last. When two neighbors get closer than 0.000001 apart, the backend renumbers that column as 1, 2, 3 and so on in the same transaction. Renumbering isn't a change anyone made to the other deals, so they keep who last changed them and when (U8 in [accounts.md](accounts.md#who-added-what)).

### API

| Method and path | Purpose |
| --- | --- |
| `POST /deals/{id}/move` | body `{stage, before_id, after_id}`; changes stage and position in one transaction |

### Screens

**Pipeline.** Six columns side by side filling the width, each 1/6 wide with a minimum of 196 px and the board scrolling sideways below that. Each column header has a stage-colored dot, the stage name, the count, and the total and expected revenue in JetBrains Mono. Cards are white (black in dark mode), compact and lift with a stronger shadow while dragged. A card shows the deal name, then the organization and main contact, then the value with the probability ring on the right, then the close date and any Late badge. The probability ring is a small circle (30 px) with the percentage in its center and an arc filled to that percentage in the stage's color. Cards in Won and Lost show no ring and say "Closed" before the date. While a card is dragged, a Sea Green line shows where it will land. Won and Lost columns have a faint tint of their stage color so they read as closed.

**Pipeline on a phone (P9 to P11).** The stage tabs are pills 40 px high on the panel color; the chosen one is on the raised color with a 2 px Sea Green ring. Cards fill the width, with the same content as on a laptop, and the close date and "Move to" button share the last line, the button on the right. The "Move to" sheet rises from the bottom: its title names the deal (Move "Mobile app" to), then a line in secondary text, "It goes to the top of that stage.", then the six stages as rows 52 px high with their color dots, "(now)" after the current one, then Move up and Move down. In landscape the tabs and the stage's totals share the top bar's row, and the cards run in two columns.
