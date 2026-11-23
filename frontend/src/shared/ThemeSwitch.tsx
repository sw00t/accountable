import { useState } from "react";
import { Moon } from "lucide-react";
import { currentMode, setMode, type Mode } from "./theme/mode";

/** M1: the "Dark mode" switch at the bottom of the sidebar. */
export function ThemeSwitch() {
  // Starts from <html>, which index.html has already set, so the two can't disagree.
  const [mode, setShown] = useState<Mode>(currentMode);
  const dark = mode === "dark";

  function toggle() {
    const next = dark ? "light" : "dark";
    setMode(next);
    setShown(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      className="theme-switch"
      onClick={toggle}
    >
      <Moon size={18} aria-hidden="true" />
      <span className="theme-switch-label">Dark mode</span>
      <span className="theme-switch-track" aria-hidden="true" />
    </button>
  );
}
