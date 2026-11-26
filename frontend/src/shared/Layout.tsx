import { useState } from "react";
import { Outlet } from "react-router-dom";
import { usePhoneShape } from "./phone";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";
import { TopBarSlot } from "./topBarSlot";

export function Layout() {
  const shape = usePhoneShape();
  const phone = shape !== null;
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <TopBarSlot.Provider value={phone ? slot : null}>
      <div className={phone ? `app phone ${shape}` : "app"}>
        {!phone && <Sidebar />}
        <div className="workspace">
          <TopBar titleSlot={phone ? setSlot : undefined} />
          <main>
            <Outlet />
          </main>
        </div>
        {phone && <TabBar />}
      </div>
    </TopBarSlot.Provider>
  );
}
