import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TopBarSlot } from "./topBarSlot";

type Props = { title: string; summary?: ReactNode; action?: ReactNode };

/** The page's title, summary and main action; on a phone they sit in the top bar. */
export function PageHeader({ title, summary, action }: Props) {
  const slot = useContext(TopBarSlot);
  const header = (
    <header className="page-head">
      <div className="page-title">
        <h1>{title}</h1>
        {summary !== undefined && <div className="muted">{summary}</div>}
      </div>
      {action && <div className="page-action">{action}</div>}
    </header>
  );
  return slot ? createPortal(header, slot) : header;
}
