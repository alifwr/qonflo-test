export type TaskStatus = "to_do" | "pending" | "in_progress" | "done";

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: number;
  taskId: string;
  taskTitle: string;
  actor: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  createdAt: string;
};

export type CreateTaskRequest = {
  title: string;
  description?: string;
  actor: string;
};

export type UpdateStatusRequest = {
  status: TaskStatus;
  actor: string;
};

export type UpdateStatusResponse = {
  task: Task;
  changed: boolean;
};

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_ACTOR"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

export const TASK_STATUSES: readonly TaskStatus[] = [
  "to_do",
  "pending",
  "in_progress",
  "done",
];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}
