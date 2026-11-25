import { useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { chooseTheme, chosenTheme, type Theme } from "./mode";

const CHOICES = [
  { theme: "light", label: "Light", Icon: Sun },
  { theme: "dark", label: "Dark", Icon: Moon },
  { theme: "system", label: "System", Icon: Monitor },
] satisfies { theme: Theme; label: string; Icon: LucideIcon }[];

/**
 * M1: Light, Dark and System side by side, for the user menu. They are menu items, so the
 * menu moves focus to them with the arrow keys; Enter, Space or a click picks one.
 */
export function ThemeChoice({ labelledBy }: { labelledBy: string }) {
  const [theme, setTheme] = useState<Theme>(chosenTheme);

  function choose(next: Theme) {
    chooseTheme(next);
    setTheme(next);
  }

  return (
    <div role="group" aria-labelledby={labelledBy} className="theme-choice">
      {CHOICES.map(({ theme: option, label, Icon }) => (
        <button
          key={option}
          type="button"
          role="menuitemradio"
          aria-checked={theme === option}
          tabIndex={-1}
          onClick={() => choose(option)}
        >
          <Icon size={16} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
