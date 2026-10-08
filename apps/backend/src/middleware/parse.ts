import { isActor, isTaskStatus } from "@mtm/shared";
import type { TaskStatus } from "@mtm/shared";
import { invalidActor, validationError } from "./errors.js";

function asObject(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function parseActor(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    throw validationError("actor is required");
  }
  if (typeof value !== "string") {
    throw validationError("actor must be a string");
  }
  if (!isActor(value)) {
    throw invalidActor();
  }
  return value;
}

export function parseCreateTaskBody(body: unknown): {
  title: string;
  description: string | undefined;
  actor: string;
} {
  const obj = asObject(body);
  if (typeof obj.title !== "string") {
    throw validationError("title is required");
  }
  const title = obj.title.trim();
  if (title.length === 0) {
    throw validationError("title must be a non-empty string");
  }
  let description: string | undefined;
  if (obj.description !== undefined && obj.description !== null) {
    if (typeof obj.description !== "string") {
      throw validationError("description must be a string");
    }
    const trimmed = obj.description.trim();
    if (trimmed.length > 0) {
      description = trimmed;
    }
  }
  return { title, description, actor: parseActor(obj.actor) };
}

export function parseUpdateStatusBody(body: unknown): { status: TaskStatus; actor: string } {
  const obj = asObject(body);
  if (obj.status === undefined) {
    throw validationError("status is required");
  }
  if (!isTaskStatus(obj.status)) {
    throw validationError("Unknown status value");
  }
  return { status: obj.status, actor: parseActor(obj.actor) };
}
