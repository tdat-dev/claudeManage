import { useState, useEffect, useRef } from "react";
import { LogEntry } from "../lib/tauri";

interface LogViewerProps {
  logs: LogEntry[];
  title?: string;
  className?: string;
}

export default function LogViewer({ logs, title, className }: LogViewerProps) {
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filtered = search
    ? logs.filter((l) => l.line.toLowerCase().includes(search.toLowerCase()))
    : logs;

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-town-border/30 bg-town-surface/50">
        <div className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-town-accent"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span className="section-title">{title || "Logs"}</span>
          <span className="text-[10px] text-town-text-faint bg-town-bg/50 px-1.5 py-0.5 rounded-full">
            {filtered.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-town-text-faint"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter..."
              className="bg-town-bg/60 border border-town-border/40 rounded-lg pl-8 pr-3 py-1.5 text-xs w-40 focus:outline-none focus:border-town-accent/50 focus:ring-1 focus:ring-town-accent/20 transition-all"
            />
          </div>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
              autoScroll
                ? "bg-town-accent/10 text-town-accent border border-town-accent/20"
                : "bg-town-bg/50 text-town-text-faint border border-town-border/40 hover:text-town-text-muted"
            }`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="7 13 12 18 17 13" />
              <polyline points="7 6 12 11 17 6" />
            </svg>
            Auto
          </button>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={containerRef}
        className={`${className ?? "h-80"} overflow-y-auto p-3 font-mono text-[12px] leading-[1.6] bg-town-bg/30`}
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-town-text-faint text-xs">
            {search ? "No matching lines" : "No log output yet"}
          </div>
        ) : (
          filtered.map((entry, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap break-all hover:bg-town-surface/30 px-1 -mx-1 rounded ${
                entry.stream === "stderr"
                  ? "text-town-danger/75"
                  : "text-town-text/85"
              }`}
            >
              <span className="text-town-text-faint/40 select-none text-[11px]">
                {new Date(entry.timestamp).toLocaleTimeString()}{" "}
              </span>
              {entry.line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
