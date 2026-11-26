import "@testing-library/jest-dom/vitest";
import { act, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { PHONE_QUERY } from "./shared/phone";

/**
 * jsdom has no matchMedia. This stand-in answers the phone query from `setPhone`, laptop by
 * default, and every other query as not matching. Tests that want a phone call `setPhone(true)`.
 */
let phone = false;
const phoneListeners = new Set<() => void>();

window.matchMedia = (media: string) => {
  const isPhoneQuery = media === PHONE_QUERY;
  return {
    media,
    get matches() {
      return isPhoneQuery && phone;
    },
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => {
      if (isPhoneQuery) phoneListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => phoneListeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
};

/** Switches the phone layout on or off, as turning a phone or resizing a window would. */
export function setPhone(on: boolean) {
  if (phone === on) return;
  phone = on;
  act(() => phoneListeners.forEach((listener) => listener()));
}

afterEach(() => {
  cleanup();
  phone = false;
  phoneListeners.clear();
});
