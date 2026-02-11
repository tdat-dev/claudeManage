import { useState } from "react";
import Layout, { NavPage } from "./components/Layout";
import RigList from "./components/RigList";
import RigDetails from "./components/RigDetails";
import RigCreateDialog from "./components/RigCreateDialog";
import TaskBoard from "./components/TaskBoard";
import TaskCreateDialog from "./components/TaskCreateDialog";
import TaskExecuteDialog from "./components/TaskExecuteDialog";
import RunHistory from "./components/RunHistory";
import TerminalTabs from "./components/TerminalTabs";
import SettingsPage from "./components/SettingsPage";
import { useRigs } from "./hooks/useRigs";
import { useTasks } from "./hooks/useTasks";
import { useSettings } from "./hooks/useSettings";
import { TaskItem, executeTask } from "./lib/tauri";

export default function App() {
  const { rigs, selectedRig, loading, error, addRig, selectRig, removeRig } = useRigs();
  const { tasks, loading: tasksLoading, addTask, editTask, removeTask } = useTasks(selectedRig?.id ?? null);
  const { settings, loading: settingsLoading, saving, save: saveSettings, validatePath } = useSettings();

  const [activePage, setActivePage] = useState<NavPage>("rigs");
  const [showCreate, setShowCreate] = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [executeTarget, setExecuteTarget] = useState<TaskItem | null>(null);

  const renderContent = () => {
    switch (activePage) {
      case "rigs":
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

      case "tasks":
        if (!selectedRig) {
          return (
            <div className="flex items-center justify-center h-full text-town-text-muted">
              <p className="text-sm">Select a rig first to manage tasks.</p>
            </div>
          );
        }
        return (
          <TaskBoard
            tasks={tasks}
            loading={tasksLoading}
            onCreateClick={() => setShowTaskCreate(true)}
            onEdit={editTask}
            onDelete={removeTask}
            onExecute={(task) => setExecuteTarget(task)}
          />
        );

      case "workers":
        return <TerminalTabs rigId={selectedRig?.id ?? ""} />;

      case "runs":
        return <RunHistory rigId={selectedRig?.id ?? null} />;

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
        <RigCreateDialog onCreated={async (path) => { await addRig(path); }} onClose={() => setShowCreate(false)} />
      )}

      {showTaskCreate && (
        <TaskCreateDialog
          onCreated={async (title, description, tags, priority) => {
            await addTask(title, description, tags, priority);
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
