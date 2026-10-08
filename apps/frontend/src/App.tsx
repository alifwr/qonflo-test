import { getNextStatus, type AuditLog, type Task } from "@mtm/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { AuditLogView } from "./components/AuditLogView";
import { TaskForm } from "./components/TaskForm";
import { TaskList } from "./components/TaskList";

export function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [auditTask, setAuditTask] = useState<Task | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const refresh = useCallback(async () => {
    const list = await api.listTasks();
    setTasks(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tasks");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function handleCreate(input: { title: string; description?: string; actor: string }) {
    setCreating(true);
    setError(null);
    try {
      await api.createTask(input);
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleAdvance(taskId: string, actor: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      return;
    }
    const next = getNextStatus(task.status);
    if (!next) {
      return;
    }
    setBusyId(taskId);
    setError(null);
    try {
      await api.updateStatus(taskId, { status: next, actor });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  function handleDelete(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"? History will be kept.`)) {
      return;
    }
    setError(null);
    void (async () => {
      try {
        await api.deleteTask(task.id);
        await refresh();
        if (auditTask?.id === task.id) {
          setAuditTask(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete task");
      }
    })();
  }

  function handleViewAudit(task: Task) {
    setAuditTask(task);
    setAuditLogs(null);
    setAuditError(null);
    setAuditLoading(true);
    void api
      .auditLogs(task.id)
      .then((logs) => setAuditLogs(logs))
      .catch((err: unknown) => {
        setAuditError(err instanceof Error ? err.message : "Failed to load audit logs");
      })
      .finally(() => setAuditLoading(false));
  }

  return (
    <main className="layout">
      <header>
        <h1>Mini Task Manager</h1>
        <p className="muted">Status moves one step at a time. Every change is recorded.</p>
      </header>
      {error ? <p className="error banner">{error}</p> : null}
      <TaskForm busy={creating} onCreate={handleCreate} />
      <section className="panel">
        <h2>Tasks</h2>
        {loading ? <p>Loading…</p> : <TaskList
          tasks={tasks}
          busyId={busyId}
          onAdvance={handleAdvance}
          onDelete={handleDelete}
          onViewAudit={handleViewAudit}
        />}
      </section>
      {auditTask ? (
        <AuditLogView
          task={auditTask}
          logs={auditLogs}
          loading={auditLoading}
          error={auditError}
          onClose={() => setAuditTask(null)}
        />
      ) : null}
    </main>
  );
}
