import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const here = path.dirname(fileURLToPath(import.meta.url));

export function openDb(filePath?: string): Database.Database {
  const resolved = filePath ?? path.join(path.resolve(here, "../../data"), "app.db");
  if (resolved !== ":memory:") {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }
  const db = new Database(resolved);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  const schema = fs.readFileSync(path.join(here, "schema.sql"), "utf8");
  db.exec(schema);
  return db;
}
