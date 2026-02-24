import { useState, useEffect } from "react";
import { useAuditLog } from "../hooks/useAuditLog";
import { t } from "../lib/i18n";

const eventTypeLabels: Record<
  string,
  { labelKey: string; color: string; icon: string }
> = {
  task_created: { labelKey: "audit_task_created", color: "text-town-accent", icon: "+" },
  task_updated: { labelKey: "audit_task_updated", color: "text-town-text-muted", icon: "✎" },
  task_status_changed: { labelKey: "audit_status_changed", color: "text-town-warning", icon: "→" },
  task_deleted: { labelKey: "audit_task_deleted", color: "text-town-danger", icon: "✕" },
  worker_spawned: { labelKey: "audit_worker_spawned", color: "text-town-success", icon: "▶" },
  worker_stopped: { labelKey: "audit_worker_stopped", color: "text-town-warning", icon: "■" },
  worker_failed: { labelKey: "audit_worker_failed", color: "text-town-danger", icon: "✕" },
  worker_completed: { labelKey: "audit_worker_completed", color: "text-town-success", icon: "✓" },
  run_started: { labelKey: "audit_run_started", color: "text-town-accent", icon: "⚡" },
  run_completed: { labelKey: "audit_run_completed", color: "text-town-success", icon: "✓" },
  run_failed: { labelKey: "audit_run_failed", color: "text-town-danger", icon: "✕" },
  hook_created: { labelKey: "audit_hook_created", color: "text-town-accent", icon: "⚓" },
  hook_assigned: { labelKey: "audit_hook_assigned", color: "text-blue-400", icon: "⇢" },
  hook_slung: { labelKey: "audit_hook_slung", color: "text-town-success", icon: "⚡" },
  hook_done: { labelKey: "audit_hook_done", color: "text-town-success", icon: "✓" },
  hook_resumed: { labelKey: "audit_hook_resumed", color: "text-town-accent", icon: "↻" },
  handoff_created: { labelKey: "audit_handoff_created", color: "text-purple-400", icon: "⇄" },
  handoff_accepted: { labelKey: "audit_handoff_accepted", color: "text-purple-400", icon: "✓" },
  convoy_created: { labelKey: "audit_convoy_created", color: "text-cyan-400", icon: "◈" },
  convoy_updated: { labelKey: "audit_convoy_updated", color: "text-cyan-400", icon: "✎" },
  convoy_completed: { labelKey: "audit_convoy_completed", color: "text-town-success", icon: "✓" },
};

const defaultLabel = {
  labelKey: "audit_event",
  color: "text-town-text-muted",
  icon: "•",
};

interface AuditTimelineProps {
  rigId: string;
}

export default function AuditTimeline({ rigId }: AuditTimelineProps) {
  const { events, loading, refresh } = useAuditLog(rigId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [rigId, refresh]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const parsePayload = (json: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 rounded-2xl bg-town-surface flex items-center justify-center mb-3">
          <span className="text-xl text-town-text-faint">📋</span>
        </div>
        <p className="text-sm text-town-text-muted">{t("vi", "no_audit_events")}</p>
        <p className="text-xs text-town-text-faint mt-1">
          {t("vi", "events_appear")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event) => {
        const config = eventTypeLabels[event.event_type] || defaultLabel;
        const payload = parsePayload(event.payload_json);
        const isExpanded = expandedId === event.event_id;

        return (
          <div
            key={event.event_id}
            className="glass-card p-3 hover:border-town-border-light/40 transition-all cursor-pointer"
            onClick={() => setExpandedId(isExpanded ? null : event.event_id)}
          >
            <div className="flex items-center gap-3">
              <span className={`text-sm font-mono ${config.color}`}>
                {config.icon}
              </span>
              <span className={`text-xs font-medium ${config.color}`}>
                {t("vi", config.labelKey)}
              </span>
              <span className="text-[11px] text-town-text-faint ml-auto">
                {formatTime(event.emitted_at)}
              </span>
            </div>

            {/* Summary from payload */}
            {payload && (
              <div className="mt-1.5 ml-7">
                {"title" in payload && payload.title ? (
                  <span className="text-xs text-town-text-muted">
                    "{String(payload.title)}"
                  </span>
                ) : null}
                {"old_status" in payload &&
                  "new_status" in payload &&
                  payload.old_status &&
                  payload.new_status ? (
                  <span className="text-xs text-town-text-faint ml-2">
                    {String(payload.old_status)} → {String(payload.new_status)}
                  </span>
                ) : null}
              </div>
            )}

            {/* Expanded details */}
            {isExpanded && payload && (
              <div className="mt-2.5 ml-7 p-2.5 bg-town-bg/60 rounded-lg border border-town-border/20">
                <pre className="text-[11px] text-town-text-faint font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(payload, null, 2)}
                </pre>
                {event.work_item_id && (
                  <p className="text-[11px] text-town-text-faint mt-2">
                    {t("vi", "work_item")}: {event.work_item_id}
                  </p>
                )}
                {event.actor_id && (
                  <p className="text-[11px] text-town-text-faint">
                    {t("vi", "actor")}: {event.actor_id}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
