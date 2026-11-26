# Spec: Look and feel

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers light and dark mode (with AMOLED dark on phones), the layout every page shares on a laptop and on a phone (with its top bar and, on a phone, its tab bar), and the brand: fonts, colors, stage colors and copy. Each section's own screen is in its area file.

## Concerns

- **Concern 2: Six pipeline stages, five brand colors.** The brand gives five colors in order for things side by side. The four open stages use a sequential Cerulean scale (light to dark, since the stages are ordered), Won uses Sea Green and Lost uses Raspberry. Chart series use the brand order. In dark mode the open stages use the same four colors in reverse order (Concern 14). See [Stage colors](#stage-colors).
- **Concern 3: Two brand pairings fail contrast for small text.** White on Cerulean is 3.96:1 and white on Raspberry is 3.62:1, under the 4.5:1 needed for normal text. The brand colors are used for fills, charts and large or bold text, and darker text shades are used for small text. See [Colors](#colors).
- **Concern 12: Where the light or dark choice is kept.** G3 saves every change to the database, but the mode is a preference of this browser, not business data. It's kept in the browser's local storage, so it can be applied before the page first paints and the page never flashes the other mode. The cost: it doesn't follow a person to another browser, two people sharing a browser share it, and clearing browser data resets it to dark. Choosing System follows the device's own light or dark setting.
- **Concern 13: Text shades and fills split in dark mode.** In light mode the darker text shades (Concern 3) also serve as fills behind small white text, such as the Late badge. In dark mode the text shades get lighter, as the brand asks, so they can't carry white text any more. The fills behind small white text have their own tokens, `--raspberry-fill` and `--cerulean-fill`, which keep the dark shades in both modes.
- **Concern 14: The stage scale on a dark background.** In light mode the open stages run from pale Cerulean (New) to full Cerulean (Negotiation), so later stages stand out more against white. On black, the same order would make New the brightest. Dark mode uses the same four colors the other way round, New at full Cerulean and Negotiation palest, so later stages still stand out most. Mixing Cerulean toward black instead was ruled out: the early stages would sit under 3:1 against the black panels and be hard to see.
- **Concern 24: What counts as a phone.** The layout follows the screen's size, not the kind of device: the phone layout applies when the window is under 768 px wide, or in landscape when it's under 500 px high, since phones in landscape are 640 to 932 px wide. Everything else gets the laptop layout. A laptop window made narrow therefore shows the phone layout too, which is how the tests reach it. Widths from 768 to 1279 px, such as tablets, get the laptop layout and may scroll sideways, as before; layouts for them are a later change.
- **Concern 25: AMOLED dark and the brand's dark surfaces.** The brand's dark mode puts black panels on a deep teal page. On a phone, Dark is AMOLED dark: the page is true black, so the pixels around the panels switch off on an OLED screen. Black panels would then vanish into the page, and the brand rules out outlines, so on a phone panels, cards, sheets and the tab bar use a near-black tint of Midnight (`#0B1A1F`), and things raised inside a panel a shade lighter (`#12252C`). It's a departure from the brand's dark surfaces, agreed for phones only; on a laptop Dark keeps them.
- **Concern 26: No hover and no dragging on a phone.** A laptop shows a row's Edit and Delete on hover and moves pipeline cards by dragging. A finger can't hover, and dragging on a small screen fights with scrolling. On a phone every action has a button that's always shown: a row's actions sit behind its More button, and a card moves with "Move to" (P9 to P11 in [pipeline.md](pipeline.md#pipeline)).
- **Concern 15: Midnight does two jobs.** In light mode Midnight is both the text color and a fixed surface: the sidebar, toasts and chart tooltips, and the text on Sea Green, Marigold and Coral fills. In dark mode the text turns Sea Mist but the surfaces and the text on bright fills stay Midnight. So `--ink` is the text color that changes with the mode, and `--midnight` is the brand color that doesn't.

## Requirements

### Light and dark mode

- **M1** Dark is the theme until someone picks another. The user menu (U12), on every page, has a theme choice of Light, Dark and System. Picking one, with the mouse or the keyboard, applies it at once. System follows the device's light or dark setting, and changes with it while the page is open. Screen readers announce the three as a group with the chosen one checked, as radio items in the user menu.
- **M2** The choice is remembered in this browser after a refresh, after a restart and after signing out, and the page opens in that theme with no flash of the other one (Concern 12). A light or dark choice saved before the theme moved into the menu is kept. If the browser won't store it, the app opens in dark mode and the menu still works until the page is closed, with no error shown or logged.
- **M3** Everything follows the mode: every section and page, the sign-in screen, the top bar with its search results and user menu, tables, forms and side panels, confirm dialogs, toasts, field errors, the pipeline board and its cards, the dashboard's charts with their gridlines, axis labels and tooltips, the funnel, badges, chips and empty states.
- **M4** Changing the mode changes colors only. Layout, sizes, fonts and content stay the same, the page doesn't reload, and a form being filled in keeps what was typed.
- **M5** Text meets the same contrast rules in both modes: at least 4.5:1 for small text and 3:1 for large or bold text, against every surface it sits on, AMOLED dark's included. See [Colors](#colors).
- **M6** On a phone (Concern 24), Dark is AMOLED dark: a true black page, with panels, cards, sheets and the tab bar on near-black Midnight (Concern 25). It's the same Dark choice, not a fourth theme, so it's the theme until someone picks another, and System uses it when the device prefers dark. Turning the phone, or resizing a window across the phone size, switches between AMOLED dark and the laptop's dark at once, with no reload.

### Phones

- **N1** Every page works on a phone from 360 px wide, in portrait and in landscape, with the phone layout from Concern 24. Nothing on a page scrolls sideways except where the page says so, and no text or control is cut off.
- **N2** Anything that can be done on a laptop can be done on a phone. Where a laptop uses hover or dragging, a phone has a button that's always shown (Concern 26).
- **N3** Everything that can be tapped is at least 44 by 44 px, and controls next to each other have at least 8 px between them.
- **N4** The five sections sit in a tab bar at the bottom of the screen in portrait, and in a rail down the left in landscape, each with its icon and a short label: Dashboard, Pipeline, Deals, Contacts, Orgs. The current section is marked, as the sidebar's link is on a laptop.
- **N5** Turning the phone keeps the page, what's typed in a form, an open sheet or panel and the scroll position as near as the new shape allows.
- **N6** The keyboard still works at phone sizes, for a phone with a keyboard attached and for screen readers: every control can be reached and used, in a sensible order, with focus shown.
- **N7** Text is never smaller than on a laptop, and fields use at least 16 px text so the phone doesn't zoom in when one is tapped.

## Design

### Architecture

- Light and dark mode live in the frontend alone. Dark mode is the attribute `data-theme="dark"` on the page's `<html>` element, and `tokens.css` gives every color token its dark value under that attribute. Components, stylesheets and charts refer only to tokens, so they follow the mode with no code of their own. A few lines of script in `frontend/index.html` read the saved choice from local storage (key `accountable.theme`, value `light`, `dark` or `system`) and set the attribute before the app's first paint. A saved `light` leaves the attribute off, and a saved `system` sets it only when the device prefers dark (`prefers-color-scheme`). Anything else, including no saved choice or storage that can't be read, sets it to dark. The theme choice in the user menu changes the attribute and saves the choice, and while System is chosen the app follows the device's setting as it changes.
- AMOLED dark is the dark block's phone values: `tokens.css` overrides a few tokens under `:root[data-theme="dark"]` inside the phone media query from Concern 24. It needs no attribute or script of its own, and turning the phone switches it as the media query changes.
- The phone layout is media queries on the same components, so there's one app and one set of pages. Where a phone needs different markup, such as a table's rows as a list or the pipeline's one stage, the component asks one shared hook, `usePhone()`, which reads the same media query as the stylesheets; a test checks the two match.

### Screens

The look follows Accountable's brand guidelines, which take priority over any general design guidance (see [Brand](#brand)). It comes in light mode and dark mode, designed for a laptop or desktop screen, with a phone layout for phones in portrait and landscape (Concern 24). The chosen light look is in `docs/mockups/final-dashboard.html` and `docs/mockups/final-pipeline.html`, with a screenshot of each beside it. It's mockup A with the funnel from mockup C and the probability ring from mockup B. Dark mode is the same layout with the dark colors; screenshots of the dashboard and the pipeline in both modes are in `docs/changes/dark-mode/`. The chosen phone look is mockup A in `docs/mockups/phone/a.html`, with its screenshot beside it: a tab bar at the bottom, a rail in landscape, and the pipeline one stage at a time. Where this section and the mockups or screenshots differ, this section wins.

This file has the parts every page shares. The sign-in screen and the user menu are in [accounts.md](accounts.md#screens), the search box in [search.md](search.md#screens), the tables and forms in [tables-and-forms.md](tables-and-forms.md#screens), the timeline in [activities.md](activities.md#screens), the pipeline in [pipeline.md](pipeline.md#screens) and the dashboard in [dashboard.md](dashboard.md#screens).

**Layout.** A fixed left sidebar on Midnight with the Accountable wordmark and five links: Dashboard, Pipeline, Deals, Contacts, Organizations. The active link has a Sea Green pill behind it. Above the content, a top bar 64 px high sits on the page background, with the search box (F1) on the left and the user menu (U11) on the right. It has no panel and no line under it, as the brand rules out a single-line border at the top of the page. Content sits on the page background in panels with 12 px rounded corners, no outlines and a soft shadow. The laptop layout's minimum supported width is 1280 px.

**Dark mode.** The page background is `#04232E` and panels, cards, side panels and dialogs are black, with Sea Mist text, as the brand sets out. The sidebar, toasts and chart tooltips stay Midnight in both modes; on the dark page the sidebar is a shade lighter than the page, so it still stands apart. Primary buttons stay Sea Green with Midnight text, the Late badge and date chips keep their dark fills with white text (Concern 13), and status pills use a dark tint of their color with the lighter text shade. Shadows are deeper so panels still lift off the page. Chart gridlines and axis labels use the dark tokens; the series and the fill under the revenue line keep their brand colors.

**Layout on a phone.** No sidebar. In portrait, a tab bar sits at the bottom on the panel color, with the five sections from N4: each a 22 px icon over an 11 px label, the current one in the Sea Green text shade with a soft Sea Green pill behind its icon. It stays clear of the phone's home bar. The top bar holds the page title in Instrument Sans 22 px semibold on the left, then a 44 px search button (F8 in [search.md](search.md#search)) and the user menu's circle (U13 in [accounts.md](accounts.md#user-menu)) on the right. In landscape the tab bar becomes a rail 76 px wide down the left, with the same icons and labels stacked and the user menu's circle at its foot, and the top bar holds the title, the page's filters, the search button and the main action in one row. Content has 16 px side margins and 12 px between panels, and panels have 12 px rounded corners and 14 px padding. Side panels open full screen, and confirm dialogs and short lists of choices rise from the bottom as sheets sized to what they hold (see [tables-and-forms.md](tables-and-forms.md#screens)). The page scrolls under the top bar, which stays put, and the tab bar or rail stays in place.

**AMOLED dark.** On a phone in Dark, the page is `#000000`, panels, cards, sheets and the tab bar or rail are `#0B1A1F`, and things raised inside them, such as a selected choice or a secondary button, are `#12252C` (Concern 25). There are no shadows, since they don't show on black. Everything else keeps its dark value. The figures are in [Colors](#colors).

**Page header.** Each page has its title in Instrument Sans 28 px semibold, a short count or summary under it, and the main action (such as "Add contact") on the right as a Sea Green button with Midnight text.

**Record pages.** Two columns: details and linked records on the left (one third), timeline on the right (two thirds). The details panel has an Edit button, and at its foot who added the record and who last changed it (U10) in 13 px secondary text.

On a phone the page header becomes a row with a back button on the left and a More button on the right, which holds Edit and Delete. Under it come the record's name in 22 px semibold, its second line (a contact's job title and organization, a deal's organization and stage, an organization's industry), its status or stage, and a row of buttons: Log activity on Sea Green, and for a contact, Call and Email (C7 in [contacts.md](contacts.md#contacts)). Then one column: the details, the linked records, and the timeline. In landscape the details and linked records sit on the left and the timeline on the right, half the width each.

**Page header on a phone.** The page's main action, such as "Add contact", is a 44 px Sea Green button at the right of the top bar showing "Add" with a plus icon, and the count or summary sits under the title in 13 px secondary text.

### Brand

**Fonts.** Instrument Sans for headings and body, Instrument Serif for the occasional accent such as the empty dashboard's welcome line, JetBrains Mono for money, numbers, dates in tables and IDs. Body text is 14 px, table text 14 px, labels 13 px.

#### Colors

Defined once as CSS variables in `frontend/src/shared/theme/tokens.css`: the light values under `:root`, and the dark values under `:root[data-theme="dark"]`, which only overrides tokens the light block already defines. Nothing else in the frontend names a color. Where the two columns match, the token is the same in both modes. Contrast figures are on white in light mode, as before, and on the `#04232E` page in dark mode, the dark surface that gives text the least contrast; the black panels, row hover and status tints only raise them. AMOLED dark has its own table below.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--page` | `#F0F4F5` | `#04232E` | page background |
| `--panel` | `#FFFFFF` | `#000000` | panels, cards, side panels and dialogs |
| `--ink` | `#073B4C` | `#CDD8DB` | text (dark: 11.2:1) |
| `--ink-muted` | `#5B7A84` | `#8EA7AF` | secondary text; light on white only (4.6:1), dark on any surface (6.5:1) |
| `--midnight` | `#073B4C` | `#073B4C` | sidebar, toasts and chart tooltips; text on Sea Green, Marigold and Coral fills (Concern 15) |
| `--sea-mist` | `#CDD8DB` | `#CDD8DB` | text on Midnight (8.3:1) |
| `--sea-green` | `#06D6A0` | `#06D6A0` | primary buttons and fills, Midnight text (6.4:1) |
| `--marigold` | `#FFC145` | `#FFC145` | secondary fills, Midnight text |
| `--coral` | `#F78C6B` | `#F78C6B` | tertiary fills, Midnight text |
| `--cerulean` | `#118AB2` | `#118AB2` | information fills, focus outlines, large or bold white text |
| `--raspberry` | `#EF476F` | `#EF476F` | alerts and Lost, large or bold white text |
| `--sea-green-text` | `#047A5C` | `#4BE3B9` | Sea Green small text (light 5.3:1, dark 10.1:1) |
| `--marigold-text` | `#8A5D00` | `#FFD27A` | Marigold small text (light 5.8:1, dark 11.5:1) |
| `--coral-text` | `#B5452A` | `#FFA88C` | Coral small text (light 5.5:1, dark 8.7:1) |
| `--cerulean-text` | `#0E7596` | `#5EC2E6` | Cerulean small text, links (light 5.3:1, dark 8.0:1) |
| `--raspberry-text` | `#C42350` | `#FF8FA8` | Raspberry small text, field errors (light 5.7:1, dark 7.6:1) |
| `--raspberry-fill` | `#C42350` | `#C42350` | behind small white text: Late badge, overdue chip, danger buttons (5.7:1) |
| `--cerulean-fill` | `#0E7596` | `#0E7596` | behind small white text: upcoming chip (5.3:1) |

The lines, hover tints, table header, form fields, status tints, column washes, scrim and shadows have dark values in `tokens.css` too, chosen so every pair above still meets M5. Light mode's values are the ones it had before dark mode was added.

**AMOLED dark (M6).** At phone sizes in Dark, `tokens.css` overrides these tokens; every other token keeps its dark value. Contrast figures are against `--raised`, the AMOLED surface that gives text the least contrast.

| Token | AMOLED dark | Use |
| --- | --- | --- |
| `--page` | `#000000` | page background |
| `--panel` | `#0B1A1F` | panels, cards, sheets, the tab bar and rail (Concern 25) |
| `--raised` | `#12252C` | a selected choice, secondary buttons and icon tiles inside a panel |
| `--ink` | `#CDD8DB` | text (10.9:1) |
| `--ink-muted` | `#8EA7AF` | secondary text (6.3:1) |
| text shades | as Dark | the five `-text` tokens, each at least 7.3:1 |
| shadows | none | shadows don't show on black |

The lines, form fields and scrim get AMOLED values chosen the same way. In light mode a phone uses the light tokens unchanged.

#### Stage colors

| Stage | Light | Dark |
| --- | --- | --- |
| New | Cerulean at 35% (`#ACD6E4`) | Cerulean (`#118AB2`) |
| Qualified | Cerulean at 60% (`#70B9D1`) | Cerulean at 80% (`#41A1C1`) |
| Proposal | Cerulean at 80% (`#41A1C1`) | Cerulean at 60% (`#70B9D1`) |
| Negotiation | Cerulean (`#118AB2`) | Cerulean at 35% (`#ACD6E4`) |
| Won | Sea Green | Sea Green |
| Lost | Raspberry | Raspberry |

The percentages are Cerulean mixed with white. Dark mode reverses the open stages (Concern 14), so in both modes the later stages stand out most from the panel. Every stage color is at least 4.1:1 against the dark page and 5.3:1 against black.

**Things to avoid.** No border on one edge of a panel, no single-line rule across the top of the page, and no gradients except the one under the revenue line.

**Copy.** Plain business English, short labels, sentence case and no exclamation marks. On a phone the tab bar's labels are short ("Orgs" for Organizations), and a page's main action may say just "Add", since the page title already says what's added. Buttons say what they do: "Add deal", "Log activity", "Mark done", "Delete contact". Empty states say what's missing and how to add it, such as "No deals at this stage yet."
