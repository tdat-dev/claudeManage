import { ReactNode } from "react";

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

const navItems = [
  { label: "Rigs", active: true },
  { label: "Tasks", active: false },
  { label: "Runs", active: false },
  { label: "Settings", active: false },
];

export default function Layout({ sidebar, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-town-bg text-town-text">
      {/* Left navigation rail */}
      <div className="w-14 bg-town-surface border-r border-town-border flex flex-col items-center py-4 gap-1 shrink-0">
        <div className="text-town-accent font-bold text-lg mb-4">T</div>
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
              item.active
                ? "bg-town-accent/15 text-town-accent"
                : "text-town-text-muted/50 cursor-not-allowed"
            }`}
            title={item.label}
            disabled={!item.active}
          >
            {item.label.charAt(0)}
          </button>
        ))}
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
