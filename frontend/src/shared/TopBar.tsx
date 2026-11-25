import { UserMenu } from "../account/UserMenu";
import { SearchBox } from "../search/SearchBox";

/** Above every page: search on the left (F1) and the user menu on the right (U11). */
export function TopBar() {
  return (
    <header className="topbar">
      <SearchBox />
      <UserMenu />
    </header>
  );
}
