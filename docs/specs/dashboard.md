# Spec: Dashboard

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers the landing page: the headline figures, the charts, the pipeline visual, the sales funnel, recent activity and follow-ups.

## Concerns

- **Concern 6: How much value reaches each stage.** The funnel shows, for each stage from New to Won, the total value of deals that are at that stage now or have moved past it. Lost deals count for the stages they reached before being lost, using the stage-change history. Deals created in the sample data get a history consistent with their stage.

Concern 7 (when a deal counts as won) is in [deals.md](deals.md#concerns), and Concern 10 (overdue and upcoming follow-ups) is in [activities.md](activities.md#concerns).

## Requirements

### Dashboard

- **H1** Headline figures in a row: open pipeline value, expected revenue of open deals, revenue won this month, and follow-ups due today or overdue. Each links to the matching screen: the pipeline, the pipeline, the deals table filtered to Won, and the dashboard's own follow-ups panel (there's no separate follow-ups screen).
- **H2** A line chart of revenue won per month for the last 12 months, ending with the current month.
- **H3** A bar chart of deals won per month over the same 12 months, with deals lost alongside in a second series.
- **H4** A pipeline visual: a horizontal bar for each open stage showing its value and expected revenue, in stage colors, each bar linking to the board.
- **H5** A sales funnel from New to Won as described in Concern 6, drawn as centered bars that narrow, with the value, the number of deals and the share carried on from the previous stage at each step.
- **H6** Recent activity: the 10 latest activities and stage changes across everything, each linking to its record.
- **H7** Follow-ups: overdue first, oldest first, then upcoming, soonest first, each linking to its contact or deal (A6).
- **H8** Every figure matches the data. Marking a deal won or logging a follow-up shows on the dashboard the next time it's opened, with no refresh needed.
- **H9** On a phone the dashboard is one column in portrait: the four headline figures as a two-by-two grid of tiles, then revenue won, follow-ups, recent activity, the pipeline by stage, the funnel, and won and lost. In landscape it's two columns. Charts fill their panel's width and keep their tooltips, which open on a tap.

## Design

### Architecture

- The dashboard figures are computed by the backend in one request, so the browser doesn't have to load every activity.

### API

| Method and path | Purpose |
| --- | --- |
| `GET /dashboard` | headline figures, 12 months of won and lost, pipeline by stage, funnel, recent activity, follow-ups |

### Screens

**Dashboard.** A 12-column grid:

1. Row 1: four headline figure tiles. The value in JetBrains Mono 32 px, the label above in 14 px, a small note under it such as "12 open deals".
2. Row 2: the revenue won line chart (8 columns) and the funnel (4 columns). The funnel has one row per stage from New to Won. Each row has the stage name with its deal count under it on the left, a centered bar in the stage's color in the middle, and the value with the share carried on from the previous stage ("85% of previous") on the right. Each bar's width is in proportion to its value and centered, so the bars narrow like a funnel. The rows spread out to fill the panel's height.
3. Row 3: the pipeline by stage bars (6 columns) and the won and lost bar chart (6 columns).
4. Row 4: follow-ups (6 columns) and recent activity (6 columns).

Charts have light gridlines, no chart borders, tooltips with exact amounts and axis labels in short money form. The line chart uses Sea Green with a soft fill under the line (the one gradient on the page). The bar chart uses Sea Green for won and Coral for lost.

**Dashboard on a phone (H9).** Headline tiles are half the width each, with the value in JetBrains Mono 22 px. Each chart is 150 to 180 px high, with fewer axis labels so they don't crowd (every third month). The follow-ups and recent activity lists use rows at least 56 px high, with Mark done as a 44 px button. The funnel keeps its rows, with the stage name and count above each bar rather than beside it.
