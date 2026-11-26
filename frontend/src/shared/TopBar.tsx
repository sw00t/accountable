import { UserMenu } from "../account/UserMenu";
import { SearchBox } from "../search/SearchBox";

type Props = {
  /** On a phone, receives the element the page's header is put in, on the left (PageHeader). */
  titleSlot?: (element: HTMLElement | null) => void;
};

/** Above every page: search on the left (F1) and the user menu on the right (U11). */
export function TopBar({ titleSlot }: Props) {
  return (
    <header className="topbar">
      {titleSlot && <div className="topbar-title" ref={titleSlot} />}
      <SearchBox />
      <UserMenu />
    </header>
  );
}
