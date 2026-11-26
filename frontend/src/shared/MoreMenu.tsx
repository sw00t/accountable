import { useState } from "react";
import { Ellipsis } from "lucide-react";
import { Sheet } from "./Sheet";

export type MoreAction = { label: string; onSelect: () => void; danger?: boolean };

type Props = {
  /** What the actions are for, such as a contact's name: the sheet's title. */
  title: string;
  actions: MoreAction[];
};

/** A More button that opens a sheet of actions, in place of hover icons on a phone (Concern 26). */
export function MoreMenu({ title, actions }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="icon-btn more-btn"
        aria-label={`More for ${title}`}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>
      <Sheet title={title} open={open} onClose={() => setOpen(false)}>
        <div className="sheet-actions">
          {actions.map(({ label, onSelect, danger }) => (
            <button
              key={label}
              type="button"
              className={danger ? "sheet-action danger" : "sheet-action"}
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
