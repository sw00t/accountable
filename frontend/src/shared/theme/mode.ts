// Light or dark mode (spec M1, M2). The mode lives on <html> as data-theme="dark";
// index.html applies the saved choice before the first paint and is the only reader of storage.

export type Mode = "light" | "dark";

export const MODE_KEY = "accountable.theme";

export function currentMode(): Mode {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage is blocked: the mode still applies until the page is closed.
  }
}
