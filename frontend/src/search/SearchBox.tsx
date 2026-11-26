import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, DollarSign, Search, User, type LucideIcon } from "lucide-react";
import { failureMessage } from "../shared/api";
import { plural } from "../shared/format";
import { usePhone } from "../shared/phone";
import { stageLabel } from "../shared/stages";
import { locate } from "./highlight";
import { useSearch, type Found, type SearchResults } from "./useSearch";
import "./search.css";

export const PLACEHOLDER = "Search organizations, contacts and deals";
/** F8: full screen on a phone the box is too narrow for the laptop's words. */
export const PHONE_PLACEHOLDER = "Search everything";

type Result = { key: string; name: string; detail: string | null; path: string };

type Group = {
  label: string;
  /** One of the group, such as "contact", for the line saying how many more there are. */
  one: string;
  icon: LucideIcon;
  results: Result[];
  more: number;
};

function joined(...parts: (string | null)[]): string | null {
  return parts.filter(Boolean).join(" · ") || null;
}

/** The three groups in order (F3), leaving out any with no results. */
function groupsOf(results: SearchResults): Group[] {
  const { organizations, contacts, deals } = results;
  const groups: Group[] = [
    {
      label: "Organizations",
      one: "organization",
      icon: Building2,
      more: organizations.total - organizations.items.length,
      results: organizations.items.map((o) => ({
        key: `organization-${o.id}`,
        name: o.name,
        detail: o.industry,
        path: `/organizations/${o.id}`,
      })),
    },
    {
      label: "Contacts",
      one: "contact",
      icon: User,
      more: contacts.total - contacts.items.length,
      results: contacts.items.map((c) => ({
        key: `contact-${c.id}`,
        name: c.name,
        detail: c.organization_name,
        path: `/contacts/${c.id}`,
      })),
    },
    {
      label: "Deals",
      one: "deal",
      icon: DollarSign,
      more: deals.total - deals.items.length,
      results: deals.items.map((d) => ({
        key: `deal-${d.id}`,
        name: d.name,
        detail: joined(d.organization_name, stageLabel(d.stage)),
        path: `/deals/${d.id}`,
      })),
    },
  ];
  return groups.filter((g) => g.results.length > 0);
}

export function noResultsMessage(text: string): string {
  return `No organizations, contacts or deals match "${text}".`;
}

function Highlighted({ name, text }: { name: string; text: string }) {
  const found = locate(name, text);
  if (!found) return <>{name}</>;
  return (
    <>
      {found.before}
      <strong>{found.match}</strong>
      {found.after}
    </>
  );
}

/**
 * The search box in the top bar (F1 to F7). On a phone it's a button that opens the same
 * search full screen (F8).
 */
export function SearchBox() {
  const phone = usePhone();
  const location = useLocation();
  const navigate = useNavigate();
  // Full-screen search is a history entry of its own, so Back closes it and stays on the page.
  const fullScreen =
    phone && (location.state as { searching?: boolean } | null)?.searching === true;
  // After full-screen search closes, focus goes back to the button that opened it (N6).
  const refocus = useRef(false);
  if (phone && !fullScreen) {
    return (
      <button
        ref={(button) => {
          if (button && refocus.current) button.focus();
          refocus.current = false;
        }}
        type="button"
        className="icon-btn search-button"
        aria-label="Search"
        onClick={() =>
          navigate(
            { pathname: location.pathname, search: location.search },
            { state: { searching: true } },
          )
        }
      >
        <Search size={20} aria-hidden="true" />
      </button>
    );
  }
  const close = () => {
    refocus.current = true;
    navigate(-1);
  };
  return <SearchField fullScreen={fullScreen} onClose={close} />;
}

type FieldProps = { fullScreen: boolean; onClose: () => void };

/** The box and its results: an ARIA combobox with a grouped listbox. */
function SearchField({ fullScreen, onClose }: FieldProps) {
  const ids = useId();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(fullScreen);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { pathname } = useLocation();
  const [page, setPage] = useState(pathname);
  if (pathname !== page) {
    // A new page starts with an empty box, however the person got there.
    setPage(pathname);
    reset();
  }
  const { found, error } = useSearch(text);

  const groups = found ? groupsOf(found.results) : [];
  const results = groups.flatMap((g) => g.results);
  const optionId = (key: string) => `${ids}-${key}`;
  const active = results.find((r) => r.key === activeKey);
  const showing = open && (found !== null || error !== null);
  const expanded = showing && results.length > 0;

  function reset() {
    setText("");
    setOpen(false);
    setActiveKey(null);
  }

  function clear() {
    reset();
    onClose();
  }

  // Full-screen search starts with the keyboard up, in the box (F8).
  useEffect(() => {
    if (fullScreen) input.current?.focus();
  }, [fullScreen]);

  function choose(result: Result) {
    reset();
    // Full-screen search's own history entry gives way to the record, so Back skips it.
    navigate(result.path, { replace: fullScreen });
  }

  function step(by: 1 | -1) {
    if (!open) return setOpen(true);
    if (results.length === 0) return;
    const at = results.findIndex((r) => r.key === activeKey);
    const next =
      at < 0 && by < 0 ? results.length - 1 : (at + by + results.length) % results.length;
    setActiveKey(results[next].key);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => step(1),
      ArrowUp: () => step(-1),
      Enter: () => expanded && active && choose(active),
      Escape: () => (fullScreen ? clear() : setOpen(false)),
    };
    const handle = keys[event.key];
    if (!handle) return;
    event.preventDefault();
    handle();
  }

  return (
    <div className={fullScreen ? "top-search full" : "top-search"} role="search">
      <label className="top-search-field">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search</span>
        <input
          ref={input}
          type="text"
          role="combobox"
          placeholder={fullScreen ? PHONE_PLACEHOLDER : PLACEHOLDER}
          autoComplete="off"
          spellCheck={false}
          value={text}
          aria-expanded={expanded}
          aria-controls={`${ids}-results`}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active ? optionId(active.key) : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => !fullScreen && setOpen(false)}
        />
      </label>
      {fullScreen && (
        <button type="button" className="btn ghost search-cancel" onClick={clear}>
          Cancel
        </button>
      )}
      {showing && (
        <div className="top-search-results">
          {found ? (
            <Results
              id={`${ids}-results`}
              found={found}
              groups={groups}
              activeKey={activeKey}
              optionId={optionId}
              onChoose={choose}
            />
          ) : (
            <p className="top-search-note">{failureMessage("search", error)}</p>
          )}
        </div>
      )}
      <p className="sr-only" role="status">
        {showing && found ? announcement(found, groups) : ""}
      </p>
    </div>
  );
}

function announcement(found: Found, groups: Group[]): string {
  const total = groups.reduce((sum, g) => sum + g.results.length + g.more, 0);
  return total === 0 ? noResultsMessage(found.text) : plural(total, "result");
}

type ResultsProps = {
  id: string;
  found: Found;
  groups: Group[];
  activeKey: string | null;
  optionId: (key: string) => string;
  onChoose: (result: Result) => void;
};

function Results({ id, found, groups, activeKey, optionId, onChoose }: ResultsProps) {
  if (groups.length === 0) return <p className="top-search-note">{noResultsMessage(found.text)}</p>;
  return (
    // Pressing on a result mustn't take focus from the box, or the results would close first.
    <div
      id={id}
      role="listbox"
      aria-label="Search results"
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
    >
      {groups.map((group) => (
        <div key={group.label} role="group" aria-label={group.label} className="top-search-group">
          <div className="top-search-label" aria-hidden="true">
            {group.label}
          </div>
          {group.results.map((result) => (
            <div
              key={result.key}
              id={optionId(result.key)}
              role="option"
              tabIndex={-1}
              aria-selected={result.key === activeKey}
              className="top-search-option"
              onClick={() => onChoose(result)}
              onKeyDown={(event) => event.key === "Enter" && onChoose(result)}
            >
              <group.icon size={16} aria-hidden="true" />
              <span>
                <span className="top-search-name">
                  <Highlighted name={result.name} text={found.text} />
                </span>
                {result.detail && <span className="top-search-detail">{result.detail}</span>}
              </span>
            </div>
          ))}
          {group.more > 0 && (
            <div className="top-search-more" aria-hidden="true">
              {`${plural(group.more, `more ${group.one}`, `more ${group.label.toLowerCase()}`)}. Type more of the name to narrow it down.`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
