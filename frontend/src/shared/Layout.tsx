import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Layout() {
  return (
    <div className="app">
      <Sidebar />
      <div className="workspace">
        <TopBar />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
