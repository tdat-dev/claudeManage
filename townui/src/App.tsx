import { useState } from "react";
import Layout, { NavView } from "./components/Layout";
import Layout, { NavPage } from "./components/Layout";
import RigList from "./components/RigList";
import RigDetails from "./components/RigDetails";
import RigCreateDialog from "./components/RigCreateDialog";
import RigTerminal from "./components/RigTerminal";
import TaskBoard from "./components/TaskBoard";
import TaskCreateDialog from "./components/TaskCreateDialog";
import TaskExecuteDialog from "./components/TaskExecuteDialog";
import RunHistory from "./components/RunHistory";
import TerminalTabs from "./components/TerminalTabs";
import SettingsPage from "./components/SettingsPage";
import AuditTimeline from "./components/AuditTimeline";
import ConvoyBoard from "./components/ConvoyBoard";
import HookInbox from "./components/HookInbox";
import HandoffCenter from "./components/HandoffCenter";
import ActorPanel from "./components/ActorPanel";
import WorkflowRunner from "./components/WorkflowRunner";
import HealthDashboard from "./components/HealthDashboard";
import { useRigs } from "./hooks/useRigs";
import { useTasks } from "./hooks/useTasks";
import { useSettings } from "./hooks/useSettings";
import { useHooks } from "./hooks/useHooks";
import { useHandoffs } from "./hooks/useHandoffs";
import { useActors } from "./hooks/useActors";
import { TaskItem, executeTask } from "./lib/tauri";
import { AppLanguage, t } from "./lib/i18n";

export default function App() {
  const { rigs, selectedRig, loading, error, addRig, selectRig, removeRig } = useRigs();
  const { rigs, selectedRig, loading, error, addRig, selectRig, removeRig } =
    useRigs();
  const {
    tasks,
    loading: tasksLoading,
    addTask,
    editTask,
    removeTask,
  } = useTasks(selectedRig?.id ?? null);
  const {
    settings,
    loading: settingsLoading,
    saving,
    save: saveSettings,
    validatePath,
  } = useSettings();
  const {
    hooks,
    loading: hooksLoading,
    addHook,
    assign,
    slingNow,
    done,
    resume,
  } = useHooks(selectedRig?.id ?? null);
  const {
    handoffs,
    loading: handoffsLoading,
    addHandoff,
    accept,
  } = useHandoffs(selectedRig?.id ?? null);
  const {
    actors,
    loading: actorsLoading,
    addActor,
    removeActor,
  } = useActors(selectedRig?.id ?? null);

  const [activePage, setActivePage] = useState<NavPage>("rigs");
  const [showCreate, setShowCreate] = useState(false);
  const [activeView, setActiveView] = useState<NavView>("rigs");
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [executeTarget, setExecuteTarget] = useState<TaskItem | null>(null);
  const language: AppLanguage = settings?.language ?? "en";

  const renderContent = () => {
    switch (activePage) {
      case "rigs":
        if (loading) {
          return (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-town-accent/30 border-t-town-accent rounded-full animate-spin" />
                <span className="text-sm text-town-text-muted">
                  Loading rigs...
                </span>
              </div>
            </div>
          );
        }
        if (error) {
          return (
            <div className="p-8">
              <div className="glass-card p-5 flex items-start gap-3 max-w-lg">
                <div className="w-8 h-8 rounded-lg bg-town-danger-soft flex items-center justify-center shrink-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-town-danger"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-town-danger mb-1">
                    Error
                  </h3>
                  <p className="text-sm text-town-text-muted">{error}</p>
                </div>
              </div>
            </div>
          );
        }
        if (selectedRig) {
          return (
            <RigDetails
              rig={selectedRig}
              onDelete={removeRig}
              onRefresh={() => selectRig(selectedRig.id)}
            />
          );
        }
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gradient-accent flex items-center justify-center mx-auto mb-6 shadow-glow-lg">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                  <line x1="12" y1="22" x2="12" y2="15.5" />
                  <polyline points="22 8.5 12 15.5 2 8.5" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-town-text mb-2">
                Welcome to TownUI
              </h2>
              <p className="text-town-text-muted text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                Manage your AI coding agents across multiple repositories.
                Select a rig or add a new one to get started.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Your First Rig
              </button>
            </div>
          </div>
        );

      case "tasks":
        if (!selectedRig) {
          return (
            <div className="flex items-center justify-center h-full">
              <div className="text-center animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-town-surface flex items-center justify-center mx-auto mb-4">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-town-text-faint"
                  >
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                </div>
                <p className="text-sm text-town-text-muted">
                  Select a rig first to manage tasks
                </p>
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col h-full">
            {/* Terms & Hook/Handoff row – capped height with scroll */}
            <div className="shrink-0 max-h-[40vh] overflow-y-auto space-y-3 px-4 pt-4 pb-2">
              <div className="glass-card p-3">
                <details className="group">
                  <summary className="text-xs font-semibold cursor-pointer list-none flex items-center gap-2">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-town-text-faint group-open:rotate-90 transition-transform"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {t(language, "terms_title")}
                  </summary>
                  <ul className="text-xs text-town-text-muted space-y-1 mt-2 ml-5">
                    <li>• {t(language, "terms_hook")}</li>
                    <li>• {t(language, "terms_sling")}</li>
                    <li>• {t(language, "terms_handoff")}</li>
                    <li>• {t(language, "terms_done")}</li>
                  </ul>
                </details>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <HookInbox
                  language={language}
                  hooks={hooks}
                  tasks={tasks}
                  actors={actors}
                  loading={hooksLoading}
                  onCreateHook={async (actorId) => {
                    await addHook(actorId);
                  }}
                  onAssign={async (hookId, taskId) => {
                    await assign(hookId, taskId);
                  }}
                  onSling={async (hookId, taskId) => {
                    await slingNow(hookId, taskId);
                  }}
                  onDone={async (hookId, outcome) => {
                    await done(hookId, outcome);
                  }}
                  onResume={async (hookId) => {
                    await resume(hookId);
                  }}
                />
                <HandoffCenter
                  language={language}
                  handoffs={handoffs}
                  tasks={tasks}
                  actors={actors}
                  loading={handoffsLoading}
                  onCreate={async (
                    fromActorId,
                    toActorId,
                    workItemId,
                    contextSummary,
                    blockers,
                    nextSteps,
                  ) => {
                    await addHandoff(
                      fromActorId,
                      toActorId,
                      workItemId,
                      contextSummary,
                      blockers,
                      nextSteps,
                    );
                  }}
                  onAccept={async (handoffId, acceptedByActorId) => {
                    await accept(handoffId, acceptedByActorId);
                  }}
                />
              </div>
            </div>

            {/* Kanban board fills remaining space */}
            <div className="flex-1 min-h-0">
              <TaskBoard
                language={language}
                tasks={tasks}
                hooks={hooks}
                loading={tasksLoading}
                onCreateClick={() => setShowTaskCreate(true)}
                onEdit={editTask}
                onDelete={removeTask}
                onExecute={(task) => setExecuteTarget(task)}
                onSling={async (taskId, hookId) => {
                  await slingNow(hookId, taskId);
                }}
              />
            </div>
          </div>
        );

      case "actors":
        if (!selectedRig) {
          return (
            <div className="flex items-center justify-center h-full">
              <div className="text-center animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-town-surface flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl text-town-text-faint">👤</span>
                </div>
                <p className="text-sm text-town-text-muted">
                  Select a rig first to manage actors
                </p>
              </div>
            </div>
          );
        }
        return (
          <ActorPanel
            actors={actors}
            loading={actorsLoading}
            onAdd={addActor}
            onDelete={removeActor}
          />
        );

      case "workers":
        return <TerminalTabs rigId={selectedRig?.id ?? ""} />;

      case "runs":
        return <RunHistory rigId={selectedRig?.id ?? null} />;

      case "convoys":
        return (
          <ConvoyBoard rigs={rigs} selectedRigId={selectedRig?.id ?? null} />
        );

      case "workflows":
        return <WorkflowRunner rigId={selectedRig?.id ?? ""} />;

      case "health":
        return <HealthDashboard rigId={selectedRig?.id ?? ""} />;

      case "audit":
        if (!selectedRig) {
          return (
            <div className="flex items-center justify-center h-full">
              <div className="text-center animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-town-surface flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl text-town-text-faint">📋</span>
                </div>
                <p className="text-sm text-town-text-muted">
                  Select a rig first to view audit trail
                </p>
              </div>
            </div>
          );
        }
        return (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Audit Trail</h2>
                <p className="text-xs text-town-text-muted mt-0.5">
                  Timeline of all events in {selectedRig.name}
                </p>
              </div>
            </div>
            <AuditTimeline rigId={selectedRig.id} />
          </div>
        );

      case "settings":
        return (
          <SettingsPage
            settings={settings}
            loading={settingsLoading}
            saving={saving}
            onSave={saveSettings}
            onValidatePath={validatePath}
          />
        );
    }
  };

  const renderMainContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-town-text-muted">
          Loading...
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6">
          <div className="bg-town-danger/10 border border-town-danger/30 rounded-lg px-4 py-3 text-town-danger text-sm">
            {error}
          </div>
        </div>
      );
    }

    if (activeView === "runs") {
      return <RigTerminal rig={selectedRig} />;
    }

    if (selectedRig) {
      return <RigDetails rig={selectedRig} onDelete={removeRig} onRefresh={() => selectRig(selectedRig.id)} />;
    }

    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-town-text-muted mb-2">Welcome to TownUI</h2>
          <p className="text-town-text-muted/70 text-sm mb-4">
            Select a rig from the sidebar or add a new one to get started.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-town-accent hover:bg-town-accent-hover rounded text-sm font-medium transition-colors"
          >
            Add Rig
          </button>
        </div>
      </div>
    );
  };

  return (
    <Layout
      activeView={activeView}
      onChangeView={setActiveView}
      sidebar={
        <RigList
          rigs={rigs}
          selectedId={selectedRig?.id ?? null}
          onSelect={selectRig}
          onAddClick={() => setShowCreate(true)}
        />
      }
    >
      {renderMainContent()}
  return (
    <Layout
      activePage={activePage}
      onNavigate={setActivePage}
      sidebar={
        <RigList
          rigs={rigs}
          selectedId={selectedRig?.id ?? null}
          onSelect={(id) => {
            selectRig(id);
            setActivePage("rigs");
          }}
          onAddClick={() => setShowCreate(true)}
        />
      }
    >
      {renderContent()}

      {showCreate && (
        <RigCreateDialog
          onCreated={async (path) => {
            await addRig(path);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {showTaskCreate && (
        <TaskCreateDialog
          onCreated={async (
            title,
            description,
            tags,
            priority,
            acceptanceCriteria,
          ) => {
            await addTask(
              title,
              description,
              tags,
              priority,
              acceptanceCriteria,
            );
          }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}

      {executeTarget && (
        <TaskExecuteDialog
          task={executeTarget}
          onExecute={async (taskId, crewId, agentType, templateName) => {
            await executeTask(taskId, crewId, agentType, templateName);
          }}
          onClose={() => setExecuteTarget(null)}
        />
      )}
    </Layout>
  );
}
