import { ArrowDown, ArrowUp } from "lucide-react";
import type { DealRow } from "../deals/hooks";
import { Sheet } from "../shared/Sheet";
import { STAGES, type Stage } from "../shared/stages";
import "../shared/tables-phone.css";

type Props = {
  deal: DealRow;
  open: boolean;
  onClose: () => void;
  onStage: (stage: Stage) => void;
  /** Left out when the card is already first among the cards shown. */
  onUp?: () => void;
  /** Left out when the card is already last. */
  onDown?: () => void;
};

/**
 * P10: the Move to sheet. The six stages, the deal's own marked "(now)", then Move up and Move
 * down within the stage. Choosing anything closes the sheet, then moves the card.
 */
export function MoveSheet({ deal, open, onClose, onStage, onUp, onDown }: Props) {
  const choose = (then: () => void) => () => {
    onClose();
    then();
  };
  return (
    <Sheet title={`Move "${deal.name}" to`} open={open} onClose={onClose}>
      <p className="sheet-note">It goes to the top of that stage.</p>
      <div className="sheet-actions move-stages">
        {STAGES.map((stage) => {
          const now = stage.key === deal.stage;
          return (
            <button
              key={stage.key}
              type="button"
              className="sheet-action"
              disabled={now}
              aria-current={now ? "true" : undefined}
              onClick={choose(() => onStage(stage.key))}
            >
              <span className="dot" style={{ background: stage.color }} aria-hidden="true" />
              {stage.label}
              {now && <span className="muted"> (now)</span>}
            </button>
          );
        })}
      </div>
      {(onUp || onDown) && (
        <div className="sheet-actions move-within">
          {onUp && (
            <button type="button" className="sheet-action" onClick={choose(onUp)}>
              <ArrowUp size={18} aria-hidden="true" />
              Move up
            </button>
          )}
          {onDown && (
            <button type="button" className="sheet-action" onClick={choose(onDown)}>
              <ArrowDown size={18} aria-hidden="true" />
              Move down
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
