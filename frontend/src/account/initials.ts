/**
 * U11: the first letters of the first and last words of the display name, one letter for a
 * one-word name, or the email's first letter when there's no name, in capitals.
 */
export function initials(name: string | null, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const sources = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0] ?? email];
  return sources.map(firstLetter).join("").toUpperCase();
}

// Array.from keeps a letter outside the Basic Multilingual Plane whole.
const firstLetter = (word: string) => Array.from(word)[0] ?? "";
