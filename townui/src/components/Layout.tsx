import { ReactNode } from "react";

export type NavView = "rigs" | "tasks" | "runs" | "settings";

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  activeView: NavView;
  onChangeView: (view: NavView) => void;
}

const navItems = [
  { label: "Rigs", view: "rigs", enabled: true },
  { label: "Tasks", view: "tasks", enabled: false },
  { label: "Runs", view: "runs", enabled: true },
  { label: "Settings", view: "settings", enabled: false },
] as const satisfies ReadonlyArray<{
  label: string;
  view: NavView;
  enabled: boolean;
}>;

function isActiveNav(itemView: NavView, activeView: NavView): boolean {
  return itemView === activeView;
}

export default function Layout({ sidebar, children, activeView, onChangeView }: LayoutProps) {
  const handleNavClick = (view: NavView) => {
    onChangeView(view);
  };

  return (
    <div className="flex h-screen bg-town-bg text-town-text">
      {/* Left navigation rail */}
      <div className="w-14 bg-town-surface border-r border-town-border flex flex-col items-center py-4 gap-1 shrink-0">
        <div className="text-town-accent font-bold text-lg mb-4">T</div>
        {navItems.map((item) => {
          const active = isActiveNav(item.view, activeView);
          return (
            <button
              key={item.label}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
                active
                  ? "bg-town-accent/15 text-town-accent"
                  : item.enabled
                    ? "text-town-text-muted hover:bg-town-border/50"
                    : "text-town-text-muted/50 cursor-not-allowed"
              }`}
              title={item.label}
              disabled={!item.enabled}
              onClick={() => handleNavClick(item.view)}
            >
              {item.label.charAt(0)}
            </button>
          );
        })}
      </div>

      {/* Sidebar (rig list) */}
      <div className="w-64 bg-town-surface/50 border-r border-town-border shrink-0 overflow-hidden">
        {sidebar}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
