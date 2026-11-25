import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Schemas } from "../shared/api";

export type SearchResults = Schemas["SearchResults"];

/** Results and the text they were found for, which may trail the box while a reply is due. */
export type Found = { text: string; results: SearchResults };

export const PAUSE_MS = 150;

/**
 * `value` once it has stayed the same for the pause. Blank settles at once, so clearing the
 * box forgets the cleared text: what's typed next shows nothing until its own reply.
 */
function useAfterPause(value: string): string {
  const [settled, setSettled] = useState(value);
  if (value === "" && settled !== "") setSettled("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), PAUSE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

/**
 * Searches once typing pauses (F7). Each text is its own query, so a late reply for older
 * text lands in that text's cache entry and never on screen (R15). Until the current
 * text's reply arrives, the last results stay, and blank text shows none (F3).
 */
export function useSearch(text: string): { found: Found | null; error: Error | null } {
  const typed = text.trim();
  const settled = useAfterPause(typed);
  const query = useQuery({
    queryKey: ["search", settled],
    queryFn: async (): Promise<Found> => ({
      text: settled,
      results: await api<SearchResults>(`/search?q=${encodeURIComponent(settled)}`),
    }),
    enabled: settled !== "",
  });

  // Remembered from earlier renders, as React's docs describe, rather than in an effect.
  const [last, setLast] = useState<Found | null>(null);
  const current = typed === "" ? null : (query.data ?? null);
  if (current !== null && current !== last) setLast(current);
  if (typed === "" && last !== null) setLast(null);

  return { found: typed === "" ? null : (current ?? last), error: query.error };
}
