import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TopBarActionSlot, TopBarSlot } from "./topBarSlot";

type Props = { title: string; summary?: ReactNode; action?: ReactNode };

/**
 * The page's title, summary and main action; on a phone they sit in the top bar. In landscape
 * the action goes to the end of the top bar's row, after a page's filters and search.
 */
export function PageHeader({ title, summary, action }: Props) {
  const slot = useContext(TopBarSlot);
  const actionSlot = useContext(TopBarActionSlot);
  const actionAtEnd = action && slot && actionSlot;
  const header = (
    <header className="page-head">
      <div className="page-title">
        <h1>{title}</h1>
        {summary !== undefined && <div className="muted">{summary}</div>}
      </div>
      {action && !actionAtEnd && <div className="page-action">{action}</div>}
    </header>
  );
  if (!slot) return header;
  return (
    <>
      {createPortal(header, slot)}
      {actionAtEnd && createPortal(<div className="page-action">{action}</div>, actionSlot)}
    </>
  );
}
