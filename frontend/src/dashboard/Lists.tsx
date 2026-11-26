import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { ActivityIcon } from "../activities/ActivityIcon";
import { useMarkDone } from "../activities/hooks";
import { failureMessage } from "../shared/api";
import { FollowUpChip } from "../shared/FollowUpChip";
import { relativeDay } from "../shared/format";
import { useToast } from "../shared/Toast";
import type { Dashboard } from "./hooks";

type Ref = { id: number; name: string } | null | undefined;

function RecordLink({ contact, deal }: { contact: Ref; deal: Ref }) {
  if (deal) return <Link to={`/deals/${deal.id}`}>{deal.name}</Link>;
  if (contact) return <Link to={`/contacts/${contact.id}`}>{contact.name}</Link>;
  return null;
}

/**
 * H7, A6: overdue first, then the next 7 days, each with Mark done. Several can be saving at
 * once, so each keeps its own promise for its message and its button: `mutate`'s per-call
 * callbacks run only for the latest call, which would lose an earlier one's error.
 */
export function FollowUps({ items, today }: { items: Dashboard["follow_ups"]; today: string }) {
  const toast = useToast();
  const { mutateAsync } = useMarkDone();
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const markDone = (id: number) => {
    setSaving((s) => new Set(s).add(id));
    mutateAsync(id)
      .then(() => toast.success("Follow-up marked done."))
      .catch((error: unknown) => toast.error(failureMessage("mark the follow-up done", error)))
      .finally(() =>
        setSaving((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        }),
      );
  };
  if (!items.length)
    return <p className="muted">No follow-ups overdue or due in the next 7 days.</p>;
  return (
    <ul className="list">
      {items.map((f) => (
        <li key={f.id}>
          <ActivityIcon kind={f.type} />
          <div className="li-main">
            <div className="text">{f.description}</div>
            <RecordLink contact={f.contact} deal={f.deal} />
          </div>
          <FollowUpChip date={f.follow_up_on} status={f.status} today={today} />
          <button
            type="button"
            className="mini"
            aria-label={`Mark done: ${f.description}`}
            disabled={saving.has(f.id)}
            onClick={() => markDone(f.id)}
          >
            <Check size={13} aria-hidden="true" />
            Mark done
          </button>
        </li>
      ))}
    </ul>
  );
}

/** H6: the latest activities and stage changes, each linking to its record. */
export function RecentActivity({ items, today }: { items: Dashboard["recent"]; today: string }) {
  if (!items.length)
    return (
      <p className="muted">
        Nothing has happened yet. Log a call or move a deal and it shows here.
      </p>
    );
  return (
    <ul className="list">
      {items.map((r) => {
        const day = relativeDay(r.on, today);
        const time =
          r.kind === "stage_change" && (day === "Today" || day === "Yesterday")
            ? `, ${r.at.slice(11, 16)}`
            : "";
        return (
          <li key={`${r.kind}-${r.id}`}>
            <ActivityIcon kind={r.kind === "stage_change" ? "stage" : r.type!} />
            <div className="li-main">
              <div className="text">{r.text}</div>
              <RecordLink contact={r.contact} deal={r.deal} />
            </div>
            <span className="when">
              {day}
              {time}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
