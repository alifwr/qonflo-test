import type { TaskStatus } from "./types.js";

export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus | null> = {
  to_do: "pending",
  pending: "in_progress",
  in_progress: "done",
  done: null,
};

export function getNextStatus(status: TaskStatus): TaskStatus | null {
  return ALLOWED_TRANSITIONS[status];
}

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from] === to;
}
