# Plan: dark mode

This plan says how to build what `docs/changes/dark-mode/intent.md` asks for and `docs/spec.md` specifies. The change is frontend only: no backend, database or dependency changes.

IDs: M1 to M5 and CN12 to CN15 are the spec's [Light and dark mode](../../spec.md#light-and-dark-mode) requirements and [Concerns](../../spec.md#concerns). IC1 to IC6 are the intent's [Constraints](intent.md#constraints) in order, and SC1 to SC3 its [Success criteria](intent.md#success-criteria). PH, W, R, TF, TE and TM are this plan's phases, work items, risks, and frontend, end-to-end and by-hand tests. Test IDs carry on from the MVP's (TF17, TE22, TM05).

## Files that change

| File | Purpose | Built in | Status |
| --- | --- | --- | --- |
| `frontend/src/shared/theme/tokens.css` | Adds `--midnight`, `--raspberry-fill` and `--cerulean-fill` with today's light values, `color-scheme: light`, and a `:root[data-theme="dark"]` block with every dark value and `color-scheme: dark` | [W2.1](#w2-1), [W3.1](#w3-1) | Changed |
| `frontend/src/shared/theme/global.css` | Primary buttons take Midnight text from `--midnight`; the danger button, Late badge and date chips take `--raspberry-fill` and `--cerulean-fill` | [W2.2](#w2-2) | Changed |
| `frontend/src/shared/theme/components.css` | Sidebar, wordmark, active link, toasts and chart tooltips use `--midnight`; the sidebar pins the switch to its bottom; switch styles | [W2.2](#w2-2), [W4.3](#w4-3) | Changed |
| `frontend/index.html` | A few lines of inline script in `<head>` that read `accountable.theme` and set `data-theme="dark"` before the first paint, ignoring a storage error | [W4.1](#w4-1) | Changed |
| `frontend/src/shared/theme/mode.ts` | The storage key, the current mode read from `<html>`, and `setMode`, which sets the attribute and saves the choice, ignoring a storage error | [W4.2](#w4-2) | New |
| `frontend/src/shared/ThemeSwitch.tsx` | The "Dark mode" switch: moon icon, label, `role="switch"` with `aria-checked` | [W4.3](#w4-3) | New |
| `frontend/src/shared/Sidebar.tsx` | Renders the switch below the five links | [W4.3](#w4-3) | Changed |
| `frontend/src/shared/theme/colors.test.ts` | Reads the light and dark blocks separately (TF18) | [W2.3](#w2-3), [W3.2](#w3-2) | Changed |
| `frontend/src/shared/theme/contrast.test.ts` | Contrast of every text and surface pair in both modes (TF19) | [W3.2](#w3-2) | New |
| `frontend/src/shared/theme/mode.test.ts` | TF20 | [W4.2](#w4-2) | New |
| `frontend/src/shared/ThemeSwitch.test.tsx` | TF21 | [W4.3](#w4-3) | New |
| `e2e/dark-mode.spec.ts` | TE23 to TE29 | [W4.4](#w4-4), [W5.3](#w5-3) | New |
| `e2e/console.spec.ts` | TE21 walks every page in both modes | [W5.2](#w5-2) | Changed |
| `e2e/capture.spec.ts` | Temporary. Skipped unless `CAPTURE` is set. Records a light-mode style fingerprint of every screen and compares against it (TM06), and saves the screenshots for SC3 | [W1.1](#w1-1), [W6.1](#w6-1) | New, deleted in [PH6](#ph6) |
| `docs/changes/dark-mode/light-before.json` | Temporary. The light-mode fingerprint taken before any change | [W1.1](#w1-1) | New, deleted in [PH6](#ph6) |
| `docs/changes/dark-mode/dashboard-light.png`, `dashboard-dark.png`, `pipeline-light.png`, `pipeline-dark.png` | SC3 screenshots at 1440 by 900 | [W6.1](#w6-1) | New |
| `docs/STATUS.md` | What was done, the by-hand results and the fingerprint result | [W6.3](#w6-3) | Changed |

Not changing: the backend, `package.json` and the lockfiles (IC6: nothing new is needed), `shared/stages.ts` and `dashboard/Charts.tsx` (they already use only tokens, so they follow the mode), and `docs/spec.md` (already updated for this change; checked again in [W6.3](#w6-3)).

## Order of work

Phases run in order. Each ends with `npm run check` passing and a short note in `docs/STATUS.md`. The light-mode fingerprint is compared at the end of [PH2](#ph2), [PH4](#ph4) and [PH6](#ph6), because IC2 is the constraint most easily broken without anyone noticing.

### Phases

| Phase | Name | Work items | Done when |
| --- | --- | --- | --- |
| <a id="ph1"></a>PH1 | Light baseline | [W1.1](#w1-1) | `light-before.json` holds the fingerprint of every screen in today's light mode. |
| <a id="ph2"></a>PH2 | Split the shared tokens | [W2.1](#w2-1), [W2.2](#w2-2), [W2.3](#w2-3) | No component uses `--ink` or a text shade as a surface or as text on a bright fill, and the fingerprint matches the baseline exactly. |
| <a id="ph3"></a>PH3 | Dark tokens | [W3.1](#w3-1), [W3.2](#w3-2) | Setting `data-theme="dark"` by hand in DevTools turns every screen dark, and TF18 and TF19 pass. |
| <a id="ph4"></a>PH4 | Switch and memory | [W4.1](#w4-1), [W4.2](#w4-2), [W4.3](#w4-3), [W4.4](#w4-4) | SC2 passes end to end, and the fingerprint matches the baseline apart from the switch. |
| <a id="ph5"></a>PH5 | Every screen in dark | [W5.1](#w5-1), [W5.2](#w5-2), [W5.3](#w5-3) | TM07 finds nothing still light, unreadable or invisible, and TE21 and TE28 pass. |
| <a id="ph6"></a>PH6 | Finish | [W6.1](#w6-1), [W6.2](#w6-2), [W6.3](#w6-3) | SC1, SC2 and SC3 are met and recorded in `docs/STATUS.md`. |

### Work items

| ID | Phase | Work | Delivers | Risks handled | Tests |
| --- | --- | --- | --- | --- | --- |
| <a id="w1-1"></a>W1.1 | [PH1](#ph1) | Write `e2e/capture.spec.ts`. With `CAPTURE=record` it visits each screen in a fixed list (dashboard, pipeline, the three tables, a record page of each kind, an open side panel, an open confirm dialog, a form with field errors) and writes, for every visible element outside the switch, its position, size and computed colors (text, background, borders, outline, fill, stroke, shadow) to `light-before.json`. With `CAPTURE=compare` it diffs against that file. Run `record` on the untouched branch. | IC2 | [R1](#r1) | [TM06](#tm06) |
| <a id="w2-1"></a>W2.1 | [PH2](#ph2) | Add `--midnight` (`#073B4C`), `--raspberry-fill` (`#C42350`) and `--cerulean-fill` (`#0E7596`) to the light block, plus `color-scheme: light`. | CN13, CN15, IC3 | [R1](#r1) | [TF18](#tf18) |
| <a id="w2-2"></a>W2.2 | [PH2](#ph2) | Audit every use of `--ink`, `--raspberry-text` and `--cerulean-text`. Where `--ink` is a surface (sidebar, toasts, chart tooltips) or text on Sea Green, Marigold or Coral (buttons, wordmark, active link), switch to `--midnight`. Where a text shade is a fill behind white text (danger button, Late badge, overdue and upcoming chips), switch to the matching fill token. Then run the fingerprint compare. | CN13, CN15, IC2 | [R1](#r1) | [TM06](#tm06), [TF18](#tf18) |
| <a id="w2-3"></a>W2.3 | [PH2](#ph2) | Make `colors.test.ts` read the light block and the dark block separately, so its value checks no longer depend on which block comes first. | IC3 | None | [TF18](#tf18) |
| <a id="w3-1"></a>W3.1 | [PH3](#ph3) | Add the `:root[data-theme="dark"]` block: the spec's dark values for the Colors and Stage colors tables, with the open stages reversed (CN14), and dark values for lines, hover, table header, fields and their borders, status tints, column washes, bar sheen, stage total key, scrim and shadows. Add `color-scheme: dark`. Only tokens that change go in this block. | M3, M5, CN14, IC3, IC4, IC5 | [R4](#r4), [R5](#r5), [R8](#r8) | [TF18](#tf18), [TF19](#tf19) |
| <a id="w3-2"></a>W3.2 | [PH3](#ph3) | Write `contrast.test.ts`: list each text token with the surfaces it sits on, by role, as in the spec's Colors table, and check the ratio from `tokens.css` in both modes. Extend `colors.test.ts` with the dark-block checks. | M5, IC4 | [R6](#r6) | [TF18](#tf18), [TF19](#tf19) |
| <a id="w4-1"></a>W4.1 | [PH4](#ph4) | Add the inline script to `frontend/index.html`, before anything that paints. It sets the attribute only when the saved value is exactly `dark`, and wraps the storage read in `try`. | M2, CN12 | [R2](#r2), [R3](#r3) | [TE25](#te25), [TE26](#te26), [TF20](#tf20) |
| <a id="w4-2"></a>W4.2 | [PH4](#ph4) | Write `mode.ts`. The current mode is read from `<html>`, never from storage, so the inline script stays the only reader of the saved choice. `setMode` changes the attribute first, then saves, and ignores a storage error. | M1, M2, M4 | [R3](#r3), [R9](#r9) | [TF20](#tf20) |
| <a id="w4-3"></a>W4.3 | [PH4](#ph4) | Write `ThemeSwitch.tsx` (a `button` with `role="switch"`, `aria-checked`, a Lucide moon icon and the label "Dark mode") and place it at the bottom of the sidebar. Its colors are the sidebar's (Sea Mist, a Sea Green track when on), so it looks the same in both modes. | M1, IC1 | [R9](#r9) | [TF21](#tf21), [TE24](#te24), [TE27](#te27) |
| <a id="w4-4"></a>W4.4 | [PH4](#ph4) | Write `e2e/dark-mode.spec.ts` with TE23 to TE27, then run the fingerprint compare. | M1, M2, SC2, IC1, IC2 | [R2](#r2), [R3](#r3) | [TE23](#te23) to [TE27](#te27), [TM06](#tm06) |
| <a id="w5-1"></a>W5.1 | [PH5](#ph5) | Walk every screen and state in dark mode (TM07) and fix what doesn't follow, in `tokens.css` only. Expected spots: native date and select controls, row hover, column washes, the bar sheen on the pipeline bars, focus rings and the scrim. | M3, IC3, IC5 | [R4](#r4), [R5](#r5), [R7](#r7) | [TM07](#tm07) |
| <a id="w5-2"></a>W5.2 | [PH5](#ph5) | Run the TE21 walk once in each mode. | M3, G11 | [R5](#r5) | [TE21](#te21) |
| <a id="w5-3"></a>W5.3 | [PH5](#ph5) | Add TE28 and TE29. | M3, M4, IC5 | [R7](#r7) | [TE28](#te28), [TE29](#te29) |
| <a id="w6-1"></a>W6.1 | [PH6](#ph6) | Add a `CAPTURE=screenshots` mode to the capture spec and save the four screenshots, with sample data and today fixed as in the other tests. | SC3 | [R8](#r8) | [TM08](#tm08) |
| <a id="w6-2"></a>W6.2 | [PH6](#ph6) | Run the final fingerprint compare and note the result in `docs/STATUS.md`, then delete `e2e/capture.spec.ts` and `light-before.json`. | IC2 | [R1](#r1) | [TM06](#tm06) |
| <a id="w6-3"></a>W6.3 | [PH6](#ph6) | Run `npm run check`, do TM07 to TM09, check `docs/spec.md` still matches what was built, and update `docs/STATUS.md`. | SC1 | None | All |

## Risks

| ID | Risk | Effect | What we'll do | Handled in | Proven by |
| --- | --- | --- | --- | --- | --- |
| <a id="r1"></a>R1 | Splitting `--ink` and the text shades into new tokens changes light mode by accident | IC2 broken without any test failing, since the existing tests don't look at colors | Fingerprint every screen before touching anything and compare after [PH2](#ph2), [PH4](#ph4) and [PH6](#ph6). New tokens take exactly the old values. | [W1.1](#w1-1), [W2.2](#w2-2), [W6.2](#w6-2) | [TM06](#tm06) |
| <a id="r2"></a>R2 | The mode is applied by React after the first paint | A dark page flashes light on every load, breaking M2 | Set the attribute from an inline script in `<head>`, before the app's script and styles load | [W4.1](#w4-1) | [TE25](#te25) |
| <a id="r3"></a>R3 | Local storage is blocked or throws, as in some private windows | The app fails to start, or logs an error against G11 | Every storage read and write is wrapped; the app falls back to light and the switch still works | [W4.1](#w4-1), [W4.2](#w4-2) | [TF20](#tf20), [TE26](#te26) |
| <a id="r4"></a>R4 | Native controls ignore CSS variables: the date picker, select menus, scrollbars | Light pop-ups on a dark page, or a black calendar icon on a black field | `color-scheme` set per mode in `tokens.css`, so the browser draws its own controls dark | [W3.1](#w3-1), [W5.1](#w5-1) | [TE28](#te28), [TM07](#tm07) |
| <a id="r5"></a>R5 | A token that only made sense on white is missed, such as the white bar sheen, a near-white row hover or a Midnight-based shadow | A screen or state looks wrong in dark mode while every test passes | Give every color token a deliberate dark value, then walk every screen and state by hand, console open | [W3.1](#w3-1), [W5.1](#w5-1), [W5.2](#w5-2) | [TM07](#tm07), [TE21](#te21) |
| <a id="r6"></a>R6 | The contrast test checks a list of pairs that drifts from where text really sits | A new text and surface combination fails contrast unnoticed | Pairs listed by role, matching the spec's table; DevTools spot-check of real elements | [W3.2](#w3-2) | [TF19](#tf19), [TM09](#tm09) |
| <a id="r7"></a>R7 | A chart part computes its color once in JavaScript instead of through a CSS variable | That part stays light until a reload | Charts already pass only `var(...)` strings, which resolve at paint. TE28 switches without a reload and checks the chart's computed colors. | [W5.1](#w5-1), [W5.3](#w5-3) | [TE28](#te28) |
| <a id="r8"></a>R8 | The brand's black panels on the `#04232E` page differ by only 1.29:1, and outlines are ruled out | Panels look flat, with no visible edge | Deeper shadows in dark mode; judge it from the screenshots. If it still looks flat, raise it rather than break the brand. | [W3.1](#w3-1), [W6.1](#w6-1) | [TM08](#tm08) |
| <a id="r9"></a>R9 | The switch's state and the page's attribute get out of step, for example under React Strict Mode's double render | The switch shows on while the page is light | The switch reads its starting state from `<html>` and `setMode` is the only writer | [W4.2](#w4-2), [W4.3](#w4-3) | [TF21](#tf21), [TE24](#te24) |

## Proof

`npm test` runs every automated test below. The end-to-end tests use the existing fixtures: fresh sample data, today fixed, and any console error fails the test. Every browser context starts with empty storage, so each test starts in light mode unless it sets dark itself. All the MVP tests (TF01 to TF17, TE01 to TE22) keep passing unchanged in light mode, which shows the default is untouched in behavior.

### Frontend unit tests (Vitest)

| ID | File in `frontend/src/` | Proves | Requirements | Risks |
| --- | --- | --- | --- | --- |
| <a id="tf18"></a>TF18 | `shared/theme/colors.test.ts` | No file outside `tokens.css` names a color, and every token used exists (as before). The dark block only overrides tokens the light block defines. The five brand colors, `--midnight`, `--sea-mist`, `--raspberry-fill` and `--cerulean-fill` match the spec and are the same in both modes. The open stages are reversed in dark mode. | IC3, CN13, CN14, CN15 | [R1](#r1) |
| <a id="tf19"></a>TF19 | `shared/theme/contrast.test.ts` | Every text and surface pair in the spec's Colors table is at least 4.5:1 in both modes, white on Cerulean and Raspberry is at least 3:1 for large or bold text, and every stage color is at least 3:1 against the panel in both modes | M5, IC4 | [R6](#r6) |
| <a id="tf20"></a>TF20 | `shared/theme/mode.test.ts` | The mode is light when `<html>` has no attribute and dark when it has `data-theme="dark"`. `setMode` changes the attribute and saves `light` or `dark` under `accountable.theme`. When storage throws, the mode still changes and nothing is thrown or logged. `index.html`'s inline script uses the same key and value. | M1, M2 | [R3](#r3) |
| <a id="tf21"></a>TF21 | `shared/ThemeSwitch.test.tsx` | A switch named "Dark mode", off on a light page and on when `<html>` is already dark. Clicking it or pressing Space turns dark mode on and off, and `aria-checked` follows. | M1 | [R9](#r9) |

### End-to-end tests (Playwright with Chrome)

| ID | File in `e2e/` | Proves | Requirements | Risks |
| --- | --- | --- | --- | --- |
| <a id="te21"></a>TE21 | `console.spec.ts` (changed) | Every page and action runs with no console errors, once in light mode and once in dark | G11, M3 | [R5](#r5) |
| <a id="te23"></a>TE23 | `dark-mode.spec.ts` | A first visit opens in light mode: the switch is off and the page background is the light `--page` | M1, IC1 | None |
| <a id="te24"></a>TE24 | `dark-mode.spec.ts` | Turning the switch on makes every section dark as you move through the sidebar; after a reload it's still dark and the switch is on; turning it off and reloading brings light back | M1, M2, SC2 | [R9](#r9) |
| <a id="te25"></a>TE25 | `dark-mode.spec.ts` | With dark saved and the app's own script blocked, `<html>` already has `data-theme="dark"`, so the first paint is dark | M2, CN12 | [R2](#r2) |
| <a id="te26"></a>TE26 | `dark-mode.spec.ts` | With storage made to throw, the app opens in light mode, the switch still turns dark mode on and off, and nothing is logged | M2 | [R3](#r3) |
| <a id="te27"></a>TE27 | `dark-mode.spec.ts` | The switch can be reached with Tab and toggled with Space, and is exposed as a switch with its on or off state | M1 | None |
| <a id="te28"></a>TE28 | `dark-mode.spec.ts` | After switching without a reload: panels, a pipeline card, the side panel, the confirm dialog and a toast take their dark colors; the revenue chart's gridlines and axis labels take the dark `--line` and `--ink-muted`; primary button text stays Midnight; the page reports `color-scheme: dark` | M3, IC5, CN15 | [R4](#r4), [R7](#r7) |
| <a id="te29"></a>TE29 | `dark-mode.spec.ts` | Text typed into a contact's Log activity form is still there after switching mode, with no page reload | M4 | None |

### By hand

| ID | Check | Requirements | Risks |
| --- | --- | --- | --- |
| <a id="tm06"></a>TM06 | Light-mode fingerprint compared with the baseline after [PH2](#ph2), [PH4](#ph4) and [PH6](#ph6): identical apart from the switch | IC2 | [R1](#r1) |
| <a id="tm07"></a>TM07 | Every section walked in dark mode as a salesperson, console open: hover, keyboard focus, dragging a card, form errors, empty states, the date picker and select menus, toasts, dialogs and chart tooltips | M3, IC5 | [R4](#r4), [R5](#r5) |
| <a id="tm08"></a>TM08 | The four screenshots saved in `docs/changes/dark-mode/` and checked against the brand, including whether the panels lift off the dark page | SC3 | [R8](#r8) |
| <a id="tm09"></a>TM09 | Small text in dark mode spot-checked in Chrome DevTools: secondary text, links, field errors, status pills, the Late badge and chips | M5, IC4 | [R6](#r6) |
