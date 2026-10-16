import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import {
  ModelCatalogueSchema,
  type ModelCatalogue,
} from "../src/core/model-catalogue";
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
      `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, title TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id=1), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS model_catalogues (account_id TEXT PRIMARY KEY, data TEXT NOT NULL); PRAGMA user_version=1;`,
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
  delete(value: unknown) {
    const id = z.string().min(1).max(200).parse(value);
    this.db.prepare("DELETE FROM boards WHERE id=?").run(id);
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
  modelCatalogue(accountId: unknown): ModelCatalogue | undefined {
    const id = z.string().min(1).max(200).parse(accountId);
    const row = this.db
      .prepare("SELECT data FROM model_catalogues WHERE account_id=?")
      .get(id);
    return row
      ? ModelCatalogueSchema.parse(JSON.parse(row.data as string))
      : undefined;
  }
  saveModelCatalogue(accountId: unknown, value: unknown) {
    const id = z.string().min(1).max(200).parse(accountId);
    const catalogue = ModelCatalogueSchema.parse(value);
    this.db
      .prepare(
        "INSERT INTO model_catalogues(account_id,data) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET data=excluded.data",
      )
      .run(id, JSON.stringify(catalogue));
  }
  deleteModelCatalogue(accountId: unknown) {
    const id = z.string().min(1).max(200).parse(accountId);
    this.db.prepare("DELETE FROM model_catalogues WHERE account_id=?").run(id);
  }
}
