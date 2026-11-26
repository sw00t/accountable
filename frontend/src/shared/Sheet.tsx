import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  /** The sheet's name for screen readers, and its heading unless `heading` is false. */
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Full screen, for forms; otherwise as tall as what it holds. */
  full?: boolean;
  /** Shows the title as the sheet's heading. */
  heading?: boolean;
};

const FOCUSABLE =
  "input:not([type=hidden]), select, textarea, button:not(:disabled), a[href], [tabindex='0']";
/** How far the handle must be dragged down to close the sheet, in pixels. */
const DRAG_TO_CLOSE = 60;

/**
 * A sheet that rises from the bottom on a phone (spec Layout on a phone): a labelled modal
 * dialog that takes focus and gives it back, and closes on Escape, a tap outside it, or
 * dragging its handle down. The page doesn't scroll under it.
 */
export function Sheet({ title, open, onClose, children, full = false, heading = true }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement;
    const sheet = sheetRef.current;
    (sheet?.querySelector<HTMLElement>(FOCUSABLE) ?? sheet)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (returnTo instanceof HTMLElement) returnTo.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const startDrag = (event: PointerEvent) => {
    dragFrom.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const endDrag = (event: PointerEvent) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from !== null && event.clientY - from >= DRAG_TO_CLOSE) onClose();
  };

  return createPortal(
    // A tap on the scrim is a touch shortcut; Escape and the sheet's own buttons do the same.
    <div
      className="sheet-scrim"
      role="presentation"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={full ? "sheet full" : "sheet"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={sheetRef}
      >
        <div
          className="sheet-handle"
          aria-hidden="true"
          onPointerDown={startDrag}
          onPointerUp={endDrag}
          onPointerCancel={() => (dragFrom.current = null)}
        />
        {heading && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
