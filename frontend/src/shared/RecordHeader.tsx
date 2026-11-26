import { useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { MoreMenu } from "./MoreMenu";
import { PageHeader } from "./PageHeader";
import { usePhone } from "./phone";
import { SidePanel } from "./SidePanel";
import { TopBarSlot } from "./topBarSlot";
import "./records-phone.css";

type Props = {
  name: string;
  /** What kind of record, for "Delete contact". */
  noun: string;
  /** The second line on a phone: a contact's job and organization, a deal's organization. */
  detail?: ReactNode;
  /** The line under the title on a laptop, when it isn't `detail`. */
  summary?: ReactNode;
  /** A contact's status or a deal's stage, on a phone. */
  status?: ReactNode;
  /** Where Back goes when there's no page to go back to, such as the record's list. */
  back: string;
  onEdit: () => void;
  onDelete: () => void;
  /** The Log activity form on a phone, given the function that closes it (A7). */
  log?: (close: () => void) => ReactNode;
  /** A contact's number and address, for Call and Email on a phone (C7). */
  call?: string | null;
  email?: string | null;
};

/**
 * A record page's header (spec Record pages). On a laptop, the title, a summary and Delete.
 * On a phone, Back and More (Edit, Delete) in the top bar, then the name, second line,
 * status, and a row of buttons.
 */
export function RecordHeader(props: Props) {
  const { name, noun, detail, summary, onDelete } = props;
  if (usePhone()) return <PhoneRecordHeader {...props} />;
  return (
    <PageHeader
      title={name}
      summary={summary ?? detail}
      action={
        <button type="button" className="btn ghost" onClick={onDelete}>
          <Trash2 size={16} aria-hidden="true" />
          Delete {noun}
        </button>
      }
    />
  );
}

function PhoneRecordHeader({
  name,
  detail,
  status,
  back,
  onEdit,
  onDelete,
  log,
  call,
  email,
}: Props) {
  const slot = useContext(TopBarSlot);
  const navigate = useNavigate();
  // The first page of a visit has no history to go back to inside the app.
  const firstPage = useLocation().key === "default";
  const [logging, setLogging] = useState(false);
  const closeLog = () => setLogging(false);

  const bar = (
    <div className="record-bar">
      <button
        type="button"
        className="icon-btn"
        aria-label="Back"
        onClick={() => (firstPage ? navigate(back) : navigate(-1))}
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <MoreMenu
        title={name}
        actions={[
          { label: "Edit", onSelect: onEdit },
          { label: "Delete", onSelect: onDelete, danger: true },
        ]}
      />
    </div>
  );

  return (
    <>
      {slot ? createPortal(bar, slot) : bar}
      <header className="record-head">
        <h1>{name}</h1>
        {detail && <div className="muted">{detail}</div>}
        {status && <div className="record-status">{status}</div>}
        {(log || call || email) && (
          <div className="record-buttons">
            {call && (
              <a className="btn ghost" href={`tel:${call}`}>
                <Phone size={18} aria-hidden="true" />
                Call
              </a>
            )}
            {email && (
              <a className="btn ghost" href={`mailto:${email}`}>
                <Mail size={18} aria-hidden="true" />
                Email
              </a>
            )}
            {log && (
              <button type="button" className="btn" onClick={() => setLogging(true)}>
                <Plus size={18} aria-hidden="true" />
                Log activity
              </button>
            )}
          </div>
        )}
      </header>
      {log && (
        <SidePanel title="Log activity" open={logging} onClose={closeLog}>
          {logging && log(closeLog)}
        </SidePanel>
      )}
    </>
  );
}
