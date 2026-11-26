// What counts as a phone (spec Concern 24): a narrow window, or a short one in landscape.
// Every stylesheet's phone rules use this same query; phone.test.ts checks they match.
import { useSyncExternalStore } from "react";

export const PHONE_QUERY = "(max-width: 767px), (orientation: landscape) and (max-height: 499px)";
const LANDSCAPE_QUERY = "(orientation: landscape)";

function useMediaQuery(media: string): boolean {
  const list = () => (typeof window.matchMedia === "function" ? window.matchMedia(media) : null);
  return useSyncExternalStore(
    (onChange) => {
      const watched = list();
      watched?.addEventListener("change", onChange);
      return () => watched?.removeEventListener("change", onChange);
    },
    () => list()?.matches ?? false,
  );
}

/** Whether the phone layout applies now; re-renders when the phone turns or a window crosses the size. */
export function usePhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

/**
 * The phone layout's shape: "portrait", "landscape", or null on a laptop. Landscape rules hang
 * off a class rather than a media query of their own, since laptops are landscape too.
 */
export function usePhoneShape(): "portrait" | "landscape" | null {
  const phone = usePhone();
  const landscape = useMediaQuery(LANDSCAPE_QUERY);
  if (!phone) return null;
  return landscape ? "landscape" : "portrait";
}
