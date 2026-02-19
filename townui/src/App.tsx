import { useState } from "react";
import Layout, { NavView } from "./components/Layout";
import RigList from "./components/RigList";
import RigDetails from "./components/RigDetails";
import RigCreateDialog from "./components/RigCreateDialog";
import RigTerminal from "./components/RigTerminal";
import { useRigs } from "./hooks/useRigs";

export default function App() {
  const { rigs, selectedRig, loading, error, addRig, selectRig, removeRig } = useRigs();
  const [showCreate, setShowCreate] = useState(false);
  const [activeView, setActiveView] = useState<NavView>("rigs");

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

      {showCreate && (
        <RigCreateDialog onCreated={addRig} onClose={() => setShowCreate(false)} />
      )}
    </Layout>
  );
}
