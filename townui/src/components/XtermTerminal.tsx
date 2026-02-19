import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { listen } from "@tauri-apps/api/event";
import { writeToWorker, resizeWorkerPty, LogEntry } from "../lib/tauri";

interface XtermTerminalProps {
  workerId: string;
  isRunning: boolean;
  initialLogs: LogEntry[];
}

export default function XtermTerminal({
  workerId,
  isRunning,
  initialLogs,
}: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const isRunningRef = useRef(isRunning);

  // Keep running ref in sync
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      theme: {
        background: "#08090d",
        foreground: "#c8cdd5",
        cursor: "#10b981",
        cursorAccent: "#08090d",
        selectionBackground: "#10b98133",
        black: "#1a1d27",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e2e8f0",
        brightBlack: "#4a5568",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#f8fafc",
      },
      fontSize: 12,
      fontFamily:
        "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
      cursorBlink: true,
      convertEol: true,
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);

    // Helper to fit and sync PTY size
    const fitAndResize = () => {
      try {
        fit.fit();
        const { rows, cols } = term;
        if (rows && cols) {
          resizeWorkerPty(workerId, rows, cols).catch(() => {});
        }
      } catch {}
    };

    // Fit after DOM layout settles
    requestAnimationFrame(() => fitAndResize());

    termRef.current = term;

    // Replay stored logs for workers that already have output
    if (initialLogs.length > 0) {
      for (const log of initialLogs) {
        if (log.stream === "stderr") {
          term.write(`\x1b[31m${log.line}\x1b[0m\r\n`);
        } else {
          term.write(log.line + "\r\n");
        }
      }
    }

    // Listen for raw PTY data (live output)
    const unlisten = listen<[string, string]>("worker-pty-data", (event) => {
      const [wId, data] = event.payload;
      if (wId === workerId) {
        term.write(data);
      }
    });

    // Handle keyboard input → write to worker process
    const onDataDispose = term.onData((data) => {
      if (isRunningRef.current) {
        writeToWorker(workerId, data).catch(console.error);
      }
    });

    // Auto-fit on resize
    const resizeObserver = new ResizeObserver(() => fitAndResize());
    resizeObserver.observe(container);

    return () => {
      unlisten.then((fn) => fn());
      onDataDispose.dispose();
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [workerId]); // Only recreate when workerId changes

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: "100px" }}
    />
  );
}
