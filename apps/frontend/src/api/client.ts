import type {
  ApiErrorBody,
  AuditLog,
  CreateTaskRequest,
  Task,
  UpdateStatusRequest,
  UpdateStatusResponse,
} from "@mtm/shared";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.status = status;
    this.code = body.error.code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) {
    return undefined as T;
  }
  const body = (await res.json()) as T | ApiErrorBody;
  if (!res.ok) {
    throw new ApiError(res.status, body as ApiErrorBody);
  }
  return body as T;
}

export const api = {
  listTasks(): Promise<Task[]> {
    return request<Task[]>("/api/tasks");
  },
  createTask(payload: CreateTaskRequest): Promise<Task> {
    return request<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateStatus(id: string, payload: UpdateStatusRequest): Promise<UpdateStatusResponse> {
    return request<UpdateStatusResponse>(`/api/tasks/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteTask(id: string): Promise<void> {
    return request<void>(`/api/tasks/${id}`, { method: "DELETE" });
  },
  auditLogs(id: string): Promise<AuditLog[]> {
    return request<AuditLog[]>(`/api/tasks/${id}/audit-logs`);
  },
};
