# Intent: a phone view

## Problem

Accountable is laid out for a laptop: a fixed sidebar, tables of seven columns, a six-column pipeline, 480 px side panels and two-column record pages. A salesperson out seeing customers can't easily look up a contact before a meeting, check where a deal stands, or log a call and its follow-up straight after it.

## Proposed outcome

Accountable works in a phone's browser at the same address, with nothing to install. Anything that can be done on a laptop can be done on a phone: every page, table, form, search and the user menu fit the screen, and the sections are in reach of a thumb. On a phone the pipeline shows one stage at a time, with a way to switch stage, and each card has a "Move to" choice in place of dragging. The jobs done on the road are quick: find a record, read its timeline, log an activity with a follow-up, check today's follow-ups and move a deal on. On a phone, Dark is AMOLED dark, with a true black page, and it's the theme until the person picks another. On a laptop nothing changes.

## Constraints

- One app at one address with one API. The layout adapts to the screen's width; there's no separate mobile site or native app, and the backend doesn't change unless the plan makes the case.
- Phones from 360 px wide, in portrait and in landscape, each laid out for its shape. The laptop layout doesn't change.
- AMOLED dark applies at phone widths only. On a laptop, Dark keeps the brand's surfaces as they are.
- Nothing depends on hover or dragging, and everything that can be tapped is at least 44 by 44 px.
- The brand, both themes and the accessibility rules (M5's contrast, keyboard use) hold at every width.
- Logging a call with a follow-up on a phone takes under 30 seconds, as on a laptop.
- The end-to-end tests also run at a phone's size, in the installed Chrome. Every unit test still runs in under a second.
- No new dependencies unless the plan makes the case for one.

## Not in this change

- Installing Accountable on the home screen (a PWA), or using it offline.
- Layouts made for tablets, beyond what the phone and laptop layouts give them.
- Native apps and push notifications.

## Success criteria

1. `npm run check` passes, with end-to-end tests of the main journeys at a phone's size.
2. From 360 to 430 px wide in portrait, and on the same phones in landscape, every page fits with no sideways scrolling of the page, in light and dark.
3. At phone widths, Dark is AMOLED dark with a true black page, and a first visit on a phone opens in it.
4. Everything that can be done on a laptop can be done on a phone, the pipeline included.
5. On a phone, finding a contact by search, opening it and logging a call with a follow-up takes under 30 seconds.
6. Laptop screens look and work as before.
7. The product owner signs off how it works and how it looks on a phone in portrait and in landscape, on the live app on Render on a real phone.
