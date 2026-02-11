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
    <div className="bg-town-bg border border-town-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-town-surface border-b border-town-border">
        <span className="text-xs font-semibold text-town-text-muted uppercase tracking-wider">
          {title || "Logs"}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="bg-town-bg border border-town-border rounded px-2 py-1 text-xs w-40 focus:outline-none focus:border-town-accent"
          />
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              autoScroll
                ? "bg-town-accent/10 text-town-accent"
                : "bg-town-border text-town-text-muted"
            }`}
          >
            Auto-scroll
          </button>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={containerRef}
        className={`${className ?? "h-80"} overflow-y-auto p-3 font-mono text-xs leading-relaxed`}
      >
        {filtered.length === 0 ? (
          <div className="text-town-text-muted text-center py-8">No log output yet.</div>
        ) : (
          filtered.map((entry, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap break-all ${
                entry.stream === "stderr" ? "text-town-danger/80" : "text-town-text"
              }`}
            >
              <span className="text-town-text-muted/50 select-none">
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
