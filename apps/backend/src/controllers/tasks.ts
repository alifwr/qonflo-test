import type { Request, Response } from "express";
import type { TaskService } from "../services/tasks.js";
import { parseCreateTaskBody, parseUpdateStatusBody } from "../middleware/parse.js";

export function createTaskController(service: TaskService) {
  return {
    list(_req: Request, res: Response): void {
      res.json(service.list());
    },
    create(req: Request, res: Response): void {
      const body = parseCreateTaskBody(req.body);
      const task = service.create(body);
      res.status(201).json(task);
    },
    updateStatus(req: Request, res: Response): void {
      const { status, actor } = parseUpdateStatusBody(req.body);
      const result = service.updateStatus(req.params.id, status, actor);
      res.json(result);
    },
    remove(req: Request, res: Response): void {
      service.delete(req.params.id);
      res.status(204).send();
    },
    auditLogs(req: Request, res: Response): void {
      res.json(service.listAuditLogs(req.params.id));
    },
  };
}
