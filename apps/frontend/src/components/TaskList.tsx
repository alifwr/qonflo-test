import type { Task } from "@mtm/shared";
import { StatusControl } from "./StatusControl";

type Props = {
  tasks: Task[];
  busyId: string | null;
  onAdvance: (taskId: string, actor: string) => Promise<void>;
  onDelete: (task: Task) => void;
  onViewAudit: (task: Task) => void;
};

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function TaskList({ tasks, busyId, onAdvance, onDelete, onViewAudit }: Props) {
  if (tasks.length === 0) {
    return <p className="muted">No tasks yet.</p>;
  }

  return (
    <table className="task-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Status</th>
          <th>Updated</th>
          <th>Advance</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td>
              <div className="title">{task.title}</div>
              {task.description ? <div className="muted">{task.description}</div> : null}
            </td>
            <td>
              <span className={`badge badge-${task.status}`}>{task.status}</span>
            </td>
            <td className="nowrap">{formatUpdated(task.updatedAt)}</td>
            <td>
              <StatusControl task={task} busy={busyId === task.id} onAdvance={onAdvance} />
            </td>
            <td className="actions">
              <button type="button" onClick={() => onViewAudit(task)}>
                History
              </button>
              <button type="button" className="danger" onClick={() => onDelete(task)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
