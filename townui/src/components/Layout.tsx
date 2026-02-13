import { ReactNode } from "react";

export type NavPage =
  | "rigs"
  | "tasks"
  | "workers"
  | "runs"
  | "audit"
  | "settings";

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
}

const navItems: { label: string; page: NavPage; icon: JSX.Element }[] = [
  {
    label: "Rigs",
    page: "rigs",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Tasks",
    page: "tasks",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    label: "Workers",
    page: "workers",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    label: "Runs",
    page: "runs",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: "Audit",
    page: "audit",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: "Settings",
    page: "settings",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

export default function Layout({
  sidebar,
  children,
  activePage,
  onNavigate,
}: LayoutProps) {
  return (
    <div className="flex h-screen bg-town-bg text-town-text overflow-hidden">
      {/* Left navigation rail */}
      <nav className="w-[68px] bg-town-surface/60 border-r border-town-border/50 flex flex-col items-center py-5 shrink-0">
        {/* Logo */}
        <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center mb-6 shadow-glow-sm">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
            <line x1="12" y1="22" x2="12" y2="15.5" />
            <polyline points="22 8.5 12 15.5 2 8.5" />
          </svg>
        </div>

        {/* Nav items */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = activePage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? "bg-town-accent/12 text-town-accent shadow-glow-sm"
                    : "text-town-text-muted hover:text-town-text hover:bg-town-surface-hover"
                }`}
                title={item.label}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-town-accent rounded-r-full" />
                )}
                {item.icon}
                {/* Tooltip */}
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-town-surface-active border border-town-border rounded-lg text-xs font-medium text-town-text whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-card z-50">
                  {item.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom section */}
        <div className="mt-auto">
          <div className="w-8 h-8 rounded-lg bg-town-accent/10 flex items-center justify-center text-town-accent text-xs font-bold">
            T
          </div>
        </div>
      </nav>

      {/* Sidebar (rig list) — shown on rigs page */}
      {activePage === "rigs" && (
        <aside className="w-72 bg-town-bg-alt border-r border-town-border/40 shrink-0 overflow-hidden animate-slide-in">
          {sidebar}
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gradient-glow">
        {children}
      </main>
    </div>
  );
}
