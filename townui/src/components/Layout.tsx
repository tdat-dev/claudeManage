import { ReactNode } from "react";

export type NavPage = "rigs" | "tasks" | "workers" | "runs" | "settings";

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
}

const navItems: { label: string; page: NavPage }[] = [
  { label: "Rigs", page: "rigs" },
  { label: "Tasks", page: "tasks" },
  { label: "Workers", page: "workers" },
  { label: "Runs", page: "runs" },
  { label: "Settings", page: "settings" },
];

export default function Layout({ sidebar, children, activePage, onNavigate }: LayoutProps) {
  return (
    <div className="flex h-screen bg-town-bg text-town-text">
      {/* Left navigation rail */}
      <div className="w-14 bg-town-surface border-r border-town-border flex flex-col items-center py-4 gap-1 shrink-0">
        <div className="text-town-accent font-bold text-lg mb-4">T</div>
        {navItems.map((item) => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
              activePage === item.page
                ? "bg-town-accent/15 text-town-accent"
                : "text-town-text-muted hover:text-town-text hover:bg-town-surface"
            }`}
            title={item.label}
          >
            {item.label.charAt(0)}
          </button>
        ))}
      </div>

      {/* Sidebar (rig list) — shown on rigs page */}
      {activePage === "rigs" && (
        <div className="w-64 bg-town-surface/50 border-r border-town-border shrink-0 overflow-hidden">
          {sidebar}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
