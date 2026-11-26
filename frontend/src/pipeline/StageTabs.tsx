import { useEffect, useRef, type KeyboardEvent } from "react";
import { STAGES, type Stage } from "../shared/stages";

type Props = {
  chosen: Stage;
  /** Cards in each stage, as many as show with the search. */
  counts: Record<Stage, number>;
  onChoose: (stage: Stage) => void;
  /** The id of the panel the tabs show. */
  panel: string;
};

export const tabId = (stage: Stage) => `stage-tab-${stage}`;

/**
 * P9: the row of stage tabs on a phone, one per stage in P1's order with its color dot, name
 * and count. The row scrolls sideways and keeps the chosen tab in view; the arrow keys, Home
 * and End move between tabs as in any tab list.
 */
export function StageTabs({ chosen, counts, onChoose, panel }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // The tabs widen once the counts load, so the chosen one is put back in view then too.
  const widths = STAGES.map((s) => counts[s.key]).join();
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`#${tabId(chosen)}`)
      ?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [chosen, widths]);

  const onKeyDown = (event: KeyboardEvent) => {
    const index = STAGES.findIndex((s) => s.key === chosen);
    const next = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: STAGES.length - 1,
    }[event.key];
    const stage = next === undefined ? undefined : STAGES[next];
    if (!stage) return;
    event.preventDefault();
    onChoose(stage.key);
    document.getElementById(tabId(stage.key))?.focus();
  };

  return (
    <div className="stage-tabs" role="tablist" aria-label="Stages" ref={listRef}>
      {STAGES.map((stage) => {
        const on = stage.key === chosen;
        return (
          <button
            key={stage.key}
            id={tabId(stage.key)}
            type="button"
            role="tab"
            className={on ? "stage-tab on" : "stage-tab"}
            aria-label={`${stage.label}, ${counts[stage.key]} deals`}
            aria-selected={on}
            aria-controls={panel}
            tabIndex={on ? 0 : -1}
            onClick={() => onChoose(stage.key)}
            onKeyDown={onKeyDown}
          >
            <span className="dot" style={{ background: stage.color }} aria-hidden="true" />
            {stage.label}
            <span className="count" aria-hidden="true">
              {counts[stage.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
