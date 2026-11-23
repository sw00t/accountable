# Intent: dark mode

## Problem

Accountable only has a light mode, and some people prefer a dark screen.

## Proposed outcome

A dark mode with a toggle on every page, across every section.

## Constraints

- Light mode stays the default, and the app remembers the choice.
- Light mode looks exactly as it does today, apart from the toggle.
- Colors stay in one place, as tokens, with no scattered overrides.
- Text in dark mode meets the same contrast rules as spec.md.
- Charts, dialogs and messages follow the mode too.
- No new dependencies unless the plan makes the case for one.

## Decisions

Settled before planning, in answer to questions about the intent.

- **Dark surfaces follow the brand as written.** Page background `#04232E`, black (`#000000`) panels and cards, and Sea Mist text. The sidebar stays Midnight, so it still stands apart from the page. Brand colors too bright or too dark for small text on black get lighter text shades, as the brand asks.
- **The choice is remembered in the browser.** It's kept in localStorage, with no backend or database change, and the page is set to the right mode before it first paints, so a dark page never flashes light on load. The choice doesn't carry over to another browser or survive clearing browser data. This is a deliberate exception to G3, which covers business data.
- **The toggle sits at the bottom of the sidebar.** A labeled switch with a sun or moon icon and the words "Dark mode", pinned below the five links, so it's on every page.

## Not in this change

- Following the device's own dark mode setting.
- A layout for phones.

## Success criteria

1. npm run check passes.
2. A new end-to-end test proves that the toggle works and is remembered after a reload.
3. Screenshots of the dashboard and the pipeline in both modes are saved in docs/changes/dark-mode/.
