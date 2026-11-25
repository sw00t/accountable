// Light, Dark or System (spec M1, M2). Dark mode is data-theme="dark" on <html>.
// index.html applies the saved choice before the first paint; this keeps it in step after.

export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "accountable.theme";

const DEVICE_DARK = "(prefers-color-scheme: dark)";

// This page's choice, so the theme still works when storage is blocked (M2).
let chosen: Theme | null = null;

/** The chosen theme: this page's choice, else the saved one, else dark. */
export function chosenTheme(): Theme {
  return chosen ?? savedTheme();
}

function savedTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "system" ? saved : "dark";
  } catch {
    return "dark";
  }
}

export function chooseTheme(theme: Theme) {
  chosen = theme;
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage is blocked: the theme still applies until the page is closed.
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark" || (theme === "system" && deviceIsDark())) root.dataset.theme = "dark";
  else delete root.dataset.theme;
}

function deviceIsDark(): boolean {
  return window.matchMedia?.(DEVICE_DARK).matches ?? false;
}

/** While System is chosen, follows the device's setting as it changes. Returns the function that stops. */
export function followDeviceTheme(): () => void {
  const device = window.matchMedia?.(DEVICE_DARK);
  if (!device) return () => {};
  const follow = () => {
    if (chosenTheme() === "system") applyTheme("system");
  };
  device.addEventListener("change", follow);
  return () => device.removeEventListener("change", follow);
}
