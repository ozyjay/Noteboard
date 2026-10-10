import { DatabaseSync } from "node:sqlite";
import {
  validateBoard,
  SettingsSchema,
  defaults,
  type Board,
  type Settings,
} from "../src/core/model";
export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, title TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id=1), data TEXT NOT NULL); PRAGMA user_version=1;`,
    );
  }
  list(): Board[] {
    return this.db
      .prepare("SELECT data FROM boards ORDER BY updated_at DESC")
      .all()
      .map((r) => validateBoard(JSON.parse(r.data as string)));
  }
  save(value: unknown) {
    const b = validateBoard(value);
    this.db
      .prepare(
        "INSERT INTO boards(id,title,updated_at,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,updated_at=excluded.updated_at,data=excluded.data",
      )
      .run(b.id, b.title, b.updatedAt, JSON.stringify(b));
  }
  settings(): Settings {
    const row = this.db.prepare("SELECT data FROM settings WHERE id=1").get();
    return row
      ? SettingsSchema.parse(JSON.parse(row.data as string))
      : defaults;
  }
  saveSettings(value: unknown) {
    const s = SettingsSchema.parse(value);
    this.db
      .prepare(
        "INSERT INTO settings(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(JSON.stringify(s));
  }
  close() {
    this.db.close();
  }
}
