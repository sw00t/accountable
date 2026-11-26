import { UserMenu } from "../account/UserMenu";
import { SearchBox } from "../search/SearchBox";

type Props = {
  /** On a phone, receives the element the page's header is put in, on the left (PageHeader). */
  titleSlot?: (element: HTMLElement | null) => void;
  /** In landscape on a phone, receives the element the page's main action is put in, last. */
  actionSlot?: (element: HTMLElement | null) => void;
};

/** Above every page: search on the left (F1) and the user menu on the right (U11). */
export function TopBar({ titleSlot, actionSlot }: Props) {
  return (
    <header className="topbar">
      {titleSlot && <div className="topbar-title" ref={titleSlot} />}
      <SearchBox />
      {actionSlot && <div className="topbar-action" ref={actionSlot} />}
      <UserMenu />
    </header>
  );
}
