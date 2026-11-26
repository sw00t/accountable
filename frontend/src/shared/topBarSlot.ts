import { createContext } from "react";

/** Where, on a phone, the page's header goes: the left of the top bar (spec Layout on a phone). */
export const TopBarSlot = createContext<HTMLElement | null>(null);
