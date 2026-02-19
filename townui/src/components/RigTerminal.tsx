import { FormEvent, useEffect, useRef, useState } from "react";
import { RigInfo, TerminalCommandResult, runRigCommand } from "../lib/tauri";
import { shortenPathForCli } from "../lib/path";

interface RigTerminalProps {
  rig: RigInfo | null;
}

interface TerminalEntry {
  id: string;
  command: string;
  status: "running" | "done" | "error";
  startedAt: string;
  result: TerminalCommandResult | null;
  error: string | null;
}

const QUICK_COMMANDS = [
  "git status -sb",
  "git branch --show-current",
  "git log --oneline -n 10",
  "git fetch --all --prune",
  "git diff --stat",
];

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(2)}s`;
}

export default function RigTerminal({ rig }: RigTerminalProps) {
  const [command, setCommand] = useState("git status -sb");
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [running, setRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const handleRunCommand = async (value: string) => {
    if (!rig || running) {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const entryId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const baseEntry: TerminalEntry = {
      id: entryId,
      command: trimmed,
      status: "running",
      startedAt: new Date().toISOString(),
      result: null,
      error: null,
    };

    setRunning(true);
    setEntries((prev) => [...prev, baseEntry].slice(-80));
    setCommand("");

    try {
      const result = await runRigCommand(rig.id, trimmed);
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, status: "done", result } : entry,
        ),
      );
    } catch (error) {
      const message = String(error);
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, status: "error", error: message } : entry,
        ),
      );
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleRunCommand(command);
  };

  if (!rig) {
    return (
      <div className="p-6 h-full">
        <div className="h-full flex items-center justify-center border border-town-border rounded-xl bg-town-surface/30">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">No Rig Selected</h2>
            <p className="text-town-text-muted text-sm">Select a rig from the sidebar to open the run terminal.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div>
        <h1 className="text-2xl font-bold">Runs</h1>
        <p className="text-town-text-muted text-sm mt-1">
          Rig: <span className="font-medium text-town-text">{rig.name}</span>{" "}
          <span className="font-mono" title={rig.path}>
            ({shortenPathForCli(rig.path, 64)})
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_COMMANDS.map((quickCommand) => (
          <button
            key={quickCommand}
            type="button"
            onClick={() => void handleRunCommand(quickCommand)}
            disabled={running}
            className="px-2.5 py-1 text-xs rounded border border-town-border bg-town-surface hover:bg-town-border/60 text-town-text-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {quickCommand}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEntries([])}
          className="px-2.5 py-1 text-xs rounded border border-town-border bg-town-surface hover:bg-town-border/60 text-town-text-muted transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 min-h-0 rounded-xl border border-town-border bg-[#10131c] p-4 overflow-y-auto font-mono text-sm">
        {entries.length === 0 ? (
          <div className="text-town-text-muted/60">No runs yet. Execute a command to start this terminal session.</div>
        ) : (
          <div className="space-y-5">
            {entries.map((entry) => (
              <div key={entry.id} className="space-y-2">
                <div className="text-town-accent">$ {entry.command}</div>
                <div className="text-xs text-town-text-muted/70">
                  {new Date(entry.startedAt).toLocaleTimeString()}{" "}
                  {entry.result
                    ? `| exit ${entry.result.exit_code} | ${formatDuration(entry.result.duration_ms)}`
                    : entry.status === "running"
                      ? "| running..."
                      : ""}
                </div>

                {entry.result?.stdout ? (
                  <pre className="whitespace-pre-wrap break-words text-town-text">{entry.result.stdout}</pre>
                ) : null}

                {entry.result?.stderr ? (
                  <pre className="whitespace-pre-wrap break-words text-town-danger">{entry.result.stderr}</pre>
                ) : null}

                {entry.status === "error" && entry.error ? (
                  <pre className="whitespace-pre-wrap break-words text-town-danger">{entry.error}</pre>
                ) : null}

                {entry.status === "done" && !entry.result?.stdout && !entry.result?.stderr ? (
                  <div className="text-town-text-muted/70">(no output)</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="shrink-0 px-3 py-2 rounded bg-town-surface border border-town-border font-mono text-town-accent">
          $
        </div>
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          disabled={running}
          placeholder="Enter command..."
          className="flex-1 px-3 py-2 rounded bg-town-surface border border-town-border focus:outline-none focus:ring-1 focus:ring-town-accent font-mono text-sm"
        />
        <button
          type="submit"
          disabled={running || command.trim().length === 0}
          className="px-4 py-2 rounded bg-town-accent hover:bg-town-accent-hover text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? "Running..." : "Run"}
        </button>
      </form>
    </div>
  );
}
