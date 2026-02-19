import { useState, useEffect, useCallback } from "react";
import {
  WorkflowTemplate,
  WorkflowInstance,
  WorkflowStep,
  StepStatus,
  listWorkflowTemplates,
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  listWorkflowInstances,
  instantiateWorkflow,
  startWorkflow,
  advanceStep,
  cancelWorkflow,
  getReadySteps,
} from "../lib/tauri";

export function useWorkflows(rigId: string | null) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTemplates = useCallback(async () => {
    try {
      const data = await listWorkflowTemplates();
      setTemplates(data);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const refreshInstances = useCallback(async () => {
    if (!rigId) {
      setInstances([]);
      return;
    }
    try {
      const data = await listWorkflowInstances(rigId);
      setInstances(data);
    } catch (e) {
      setError(String(e));
    }
  }, [rigId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([refreshTemplates(), refreshInstances()]).finally(() =>
      setLoading(false),
    );
  }, [refreshTemplates, refreshInstances]);

  const addTemplate = useCallback(
    async (
      name: string,
      description: string,
      steps: WorkflowStep[],
      variables: string[],
    ) => {
      const t = await createWorkflowTemplate(
        name,
        description,
        steps,
        variables,
      );
      setTemplates((prev) => [...prev, t]);
      return t;
    },
    [],
  );

  const removeTemplate = useCallback(async (templateId: string) => {
    await deleteWorkflowTemplate(templateId);
    setTemplates((prev) => prev.filter((t) => t.template_id !== templateId));
  }, []);

  const instantiate = useCallback(
    async (
      templateId: string,
      convoyId: string | null,
      variables: Record<string, string>,
    ) => {
      if (!rigId) return null;
      const inst = await instantiateWorkflow(
        templateId,
        rigId,
        convoyId,
        variables,
      );
      setInstances((prev) => [...prev, inst]);
      return inst;
    },
    [rigId],
  );

  const start = useCallback(async (instanceId: string) => {
    const inst = await startWorkflow(instanceId);
    setInstances((prev) =>
      prev.map((i) => (i.instance_id === instanceId ? inst : i)),
    );
    return inst;
  }, []);

  const advance = useCallback(
    async (
      instanceId: string,
      stepId: string,
      newStatus: StepStatus,
      workerId?: string,
      outcome?: string,
    ) => {
      const inst = await advanceStep(
        instanceId,
        stepId,
        newStatus,
        workerId,
        outcome,
      );
      setInstances((prev) =>
        prev.map((i) => (i.instance_id === instanceId ? inst : i)),
      );
      return inst;
    },
    [],
  );

  const cancel = useCallback(async (instanceId: string) => {
    const inst = await cancelWorkflow(instanceId);
    setInstances((prev) =>
      prev.map((i) => (i.instance_id === instanceId ? inst : i)),
    );
    return inst;
  }, []);

  const readySteps = useCallback(async (instanceId: string) => {
    return getReadySteps(instanceId);
  }, []);

  return {
    templates,
    instances,
    loading,
    error,
    addTemplate,
    removeTemplate,
    instantiate,
    start,
    advance,
    cancel,
    readySteps,
    refreshTemplates,
    refreshInstances,
  };
}
