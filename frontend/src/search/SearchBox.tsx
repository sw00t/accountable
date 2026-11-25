import { useId, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, DollarSign, Search, User, type LucideIcon } from "lucide-react";
import { failureMessage } from "../shared/api";
import { plural } from "../shared/format";
import { stageLabel } from "../shared/stages";
import { locate } from "./highlight";
import { useSearch, type Found, type SearchResults } from "./useSearch";
import "./search.css";

export const PLACEHOLDER = "Search organizations, contacts and deals";

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

/** The search box in the top bar (F1 to F7), an ARIA combobox with a grouped listbox. */
export function SearchBox() {
  const ids = useId();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { pathname } = useLocation();
  const [page, setPage] = useState(pathname);
  if (pathname !== page) {
    // A new page starts with an empty box, however the person got there.
    setPage(pathname);
    clear();
  }
  const { found, error } = useSearch(text);

  const groups = found ? groupsOf(found.results) : [];
  const results = groups.flatMap((g) => g.results);
  const optionId = (key: string) => `${ids}-${key}`;
  const active = results.find((r) => r.key === activeKey);
  const showing = open && (found !== null || error !== null);
  const expanded = showing && results.length > 0;

  function clear() {
    setText("");
    setOpen(false);
    setActiveKey(null);
  }

  function choose(result: Result) {
    clear();
    navigate(result.path);
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
      Escape: () => setOpen(false),
    };
    const handle = keys[event.key];
    if (!handle) return;
    event.preventDefault();
    handle();
  }

  return (
    <div className="top-search" role="search">
      <label className="top-search-field">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search</span>
        <input
          type="text"
          role="combobox"
          placeholder={PLACEHOLDER}
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
          onBlur={() => setOpen(false)}
        />
      </label>
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
