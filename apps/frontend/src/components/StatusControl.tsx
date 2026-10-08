import { ACTORS, getNextStatus, type Task } from "@mtm/shared";
import { useState } from "react";

type Props = {
  task: Task;
  busy: boolean;
  onAdvance: (taskId: string, actor: string) => Promise<void>;
};

export function StatusControl({ task, busy, onAdvance }: Props) {
  const [actor, setActor] = useState<string>(ACTORS[0]);
  const [error, setError] = useState<string | null>(null);
  const next = getNextStatus(task.status);

  if (!next) {
    return <span className="muted">Terminal status</span>;
  }

  async function handleClick() {
    setError(null);
    try {
      await onAdvance(task.id, actor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <div className="status-control">
      <select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Actor for status change">
        {ACTORS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button type="button" disabled={busy} onClick={() => void handleClick()}>
        Move to {next}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
