import "@testing-library/jest-dom/vitest";
import { act, cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";
import { PHONE_QUERY } from "./shared/phone";

/**
 * findBy and waitFor give up before the test's own time limit (vite.config.ts's testTimeout), so
 * a wait that never comes true fails naming what it waited for, not with "Test timed out".
 */
configure({ asyncUtilTimeout: process.env.CI ? 8_000 : 800 });

/**
 * jsdom has no matchMedia. This stand-in answers the phone query and the landscape query from
 * `setPhone`, laptop by default, and every other query as not matching. Tests that want a phone
 * call `setPhone(true)` for portrait or `setPhone("landscape")`.
 */
let phone: boolean | "landscape" = false;
const phoneListeners = new Set<() => void>();
const LANDSCAPE = "(orientation: landscape)";

window.matchMedia = (media: string) => {
  const watched = media === PHONE_QUERY || media === LANDSCAPE;
  return {
    media,
    get matches() {
      if (media === PHONE_QUERY) return phone !== false;
      return media === LANDSCAPE && phone === "landscape";
    },
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => {
      if (watched) phoneListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => phoneListeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
};

/** Switches the phone layout on (in portrait, or landscape) or off, as turning a phone would. */
export function setPhone(on: boolean | "landscape") {
  if (phone === on) return;
  phone = on;
  act(() => phoneListeners.forEach((listener) => listener()));
}

afterEach(() => {
  cleanup();
  phone = false;
  phoneListeners.clear();
});
