import { NavLink } from "react-router-dom";
import { SECTIONS } from "./Sidebar";

/** The phone's sections (N4): a tab bar at the bottom in portrait, a rail on the left in landscape. */
export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Sections">
      {SECTIONS.map(({ to, label, short, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={label}
          className={({ isActive }) => (isActive ? "on" : undefined)}
        >
          <span className="tab-icon">
            <Icon size={22} aria-hidden="true" />
          </span>
          {short}
        </NavLink>
      ))}
    </nav>
  );
}
