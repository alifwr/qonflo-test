import type { AuditLog } from "./types.js";

export function formatAuditEntry(
  log: AuditLog,
  formatWhen: (iso: string) => string = (iso) => iso,
): string {
  const when = formatWhen(log.createdAt);
  if (log.fromStatus === null) {
    return `User "${log.actor}" created Task "${log.taskTitle}" with status "${log.toStatus}" at ${when}`;
  }
  return `User "${log.actor}" changed Task "${log.taskTitle}" status from "${log.fromStatus}" to "${log.toStatus}" at ${when}`;
}
