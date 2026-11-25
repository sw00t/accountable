/** A name split around the part that matches the typed text, for the bold (F4). */
export type Match = { before: string; match: string; after: string };

// Python's casefold(), which the backend matches with (Concern 20), goes further than
// toLowerCase() for these letters.
const FURTHER_FOLDS: Record<string, string> = { ß: "ss", ς: "σ", ſ: "s" };

function fold(text: string): string {
  return Array.from(text.toLowerCase(), (char) => FURTHER_FOLDS[char] ?? char).join("");
}

/**
 * Where `text` sits in `name`, ignoring case as the backend does, or null when it can't
 * be placed: not found, or found only partway through a letter that folds to two.
 */
export function locate(name: string, text: string): Match | null {
  const needle = fold(text.trim());
  if (needle === "") return null;

  // Offsets in the folded name that start a letter, each mapped to its offset in the name.
  const nameOffset = new Map<number, number>();
  let folded = "";
  let offset = 0;
  for (const char of name) {
    nameOffset.set(folded.length, offset);
    folded += fold(char);
    offset += char.length;
  }
  nameOffset.set(folded.length, offset);

  for (let at = folded.indexOf(needle); at >= 0; at = folded.indexOf(needle, at + 1)) {
    const from = nameOffset.get(at);
    const to = nameOffset.get(at + needle.length);
    if (from !== undefined && to !== undefined)
      return { before: name.slice(0, from), match: name.slice(from, to), after: name.slice(to) };
  }
  return null;
}
