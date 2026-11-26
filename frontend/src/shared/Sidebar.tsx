import { NavLink } from "react-router-dom";
import { Building2, DollarSign, LayoutDashboard, SquareKanban, User } from "lucide-react";

/** The five sections, shared by the laptop's sidebar and the phone's tab bar (N4). */
export const SECTIONS = [
  { to: "/", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/pipeline", label: "Pipeline", short: "Pipeline", icon: SquareKanban, end: false },
  { to: "/deals", label: "Deals", short: "Deals", icon: DollarSign, end: false },
  { to: "/contacts", label: "Contacts", short: "Contacts", icon: User, end: false },
  { to: "/organizations", label: "Organizations", short: "Orgs", icon: Building2, end: false },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="mark" aria-hidden="true">
          A
        </span>
        Accountable
      </div>
      <nav aria-label="Sections">
        {SECTIONS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? "on" : undefined)}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
