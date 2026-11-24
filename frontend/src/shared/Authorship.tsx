import { formatDate } from "./format";

type Stamped = {
  added_by: string;
  created_at: string;
  changed_by: string;
  updated_at: string;
};

/** U10: who added a record and who last changed it, at the foot of its details panel. */
export function Authorship({ record }: { record: Stamped }) {
  return (
    <div className="authorship muted">
      <p>
        Added by {record.added_by} on {formatDate(record.created_at)}
      </p>
      <p>
        Last changed by {record.changed_by} on {formatDate(record.updated_at)}
      </p>
    </div>
  );
}
