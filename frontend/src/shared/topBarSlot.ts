import { createContext } from "react";

/** Where, on a phone, the page's header goes: the left of the top bar (spec Layout on a phone). */
export const TopBarSlot = createContext<HTMLElement | null>(null);

/**
 * In landscape on a phone, where the page's main action goes: the end of the top bar's row,
 * after the search button, so it's read and tabbed to in the order it's seen.
 */
export const TopBarActionSlot = createContext<HTMLElement | null>(null);
