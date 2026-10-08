import { formatAuditEntry, type AuditLog, type Task } from "@mtm/shared";

type Props = {
  task: Task;
  logs: AuditLog[] | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

function displayWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString();
}

export function AuditLogView({ task, logs, loading, error, onClose }: Props) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="audit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="audit-title">Audit log — {task.title}</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {loading ? <p>Loading…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {logs && logs.length === 0 ? <p className="muted">No entries.</p> : null}
        {logs && logs.length > 0 ? (
          <ol className="audit-list">
            {logs.map((log) => (
              <li key={log.id}>{formatAuditEntry(log, displayWhen)}</li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
