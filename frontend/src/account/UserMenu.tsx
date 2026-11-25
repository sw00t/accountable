import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LogOut } from "lucide-react";
import { ThemeChoice } from "../shared/theme/ThemeChoice";
import { initials } from "./initials";
import { useSession } from "./session";
import "./account.css";

const ITEMS = '[role="menuitem"], [role="menuitemradio"]';

/** U11, U12, U4: the initials circle at the right of the top bar, and its menu. */
export function UserMenu() {
  const { person, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const circle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const label = `Account menu for ${person.name ?? person.email}`;

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>(ITEMS) ?? []);

  function close() {
    setOpen(false);
    circle.current?.focus();
  }

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>(ITEMS)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // On click, after the browser has moved focus: a field clicked into keeps it.
    const closeOutside = (event: MouseEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      setOpen(false);
      if (document.activeElement === document.body) circle.current?.focus();
    };
    document.addEventListener("click", closeOutside);
    return () => document.removeEventListener("click", closeOutside);
  }, [open]);

  function onMenuKey(event: KeyboardEvent) {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const target = {
      ArrowDown: all[(at + 1) % all.length],
      ArrowUp: all[(at - 1 + all.length) % all.length],
      Home: all[0],
      End: all[all.length - 1],
    }[event.key];
    if (target) {
      event.preventDefault();
      target.focus();
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className="user-menu" ref={root}>
      <button
        ref={circle}
        type="button"
        className="user-menu-circle"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "user-menu" : undefined}
        onClick={() => setOpen(!open)}
      >
        {initials(person.name, person.email)}
      </button>
      {open && (
        <div className="user-menu-panel">
          <div className="user-menu-person">
            {person.name && <p className="user-menu-name">{person.name}</p>}
            <p className="user-menu-email">{person.email}</p>
          </div>
          <p className="user-menu-label" id="user-menu-theme">
            Theme
          </p>
          <div
            id="user-menu"
            role="menu"
            aria-label={label}
            tabIndex={-1}
            ref={menu}
            onKeyDown={onMenuKey}
          >
            <ThemeChoice labelledBy="user-menu-theme" />
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="user-menu-sign-out"
              onClick={() => void signOut()}
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
