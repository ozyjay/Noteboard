import { expect, it, vi } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DiagnosticLog,
  diagnosticError,
  type DiagnosticEntry,
} from "../electron/diagnostics";

it("records safe structured diagnostics and strips unapproved fields including nested error data", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "noteboard-logs-"));
  try {
    const log = new DiagnosticLog(dir);
    log.write({
      event: "ipc.failed",
      operation: "provider:generate",
      prompt: "SECRET PROMPT",
      token: "SECRET TOKEN",
      error: { category: "connection", message: "SECRET RESPONSE" },
    } as DiagnosticEntry);
    const raw = readFileSync(
      path.join(log.directory, "diagnostics.jsonl"),
      "utf8",
    );
    expect(raw).not.toContain("SECRET");
    expect(JSON.parse(raw)).toMatchObject({
      event: "ipc.failed",
      operation: "provider:generate",
      error: { category: "connection" },
    });
    expect(new Date(JSON.parse(raw).timestamp).toISOString()).toBe(
      JSON.parse(raw).timestamp,
    );
    if (process.platform !== "win32")
      expect(
        statSync(path.join(log.directory, "diagnostics.jsonl")).mode & 0o777,
      ).toBe(0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("retains at most three bounded files and keeps entries valid JSON", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "noteboard-log-rotation-"));
  try {
    const log = new DiagnosticLog(dir, 300);
    for (let i = 0; i < 30; i++)
      log.write({
        event: "ipc.completed",
        operation: "boards:save",
        durationMs: i,
      });
    const files = readdirSync(log.directory);
    expect(files).toHaveLength(3);
    for (const file of files) {
      const filename = path.join(log.directory, file);
      expect(statSync(filename).size).toBeLessThanOrEqual(300);
      for (const line of readFileSync(filename, "utf8").trim().split("\n"))
        expect(() => JSON.parse(line)).not.toThrow();
    }
    expect(
      readFileSync(path.join(log.directory, "diagnostics.jsonl"), "utf8"),
    ).toContain('"durationMs":29');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("classifies nested transport causes without copying secret messages or unknown codes", () => {
  const cause = Object.assign(new Error("SECRET endpoint and token"), {
    code: "UND_ERR_SOCKET",
  });
  expect(
    diagnosticError(new Error("The connection was interrupted", { cause })),
  ).toEqual({ category: "connection", code: "UND_ERR_SOCKET" });
  expect(
    diagnosticError(Object.assign(new Error("SECRET"), { code: "SECRET" })),
  ).toEqual({ category: "unknown" });
  expect(diagnosticError(new DOMException("SECRET", "TimeoutError"))).toEqual({
    category: "timeout",
  });
  const cyclic = new Error("SECRET") as Error & { cause: unknown };
  cyclic.cause = cyclic;
  expect(diagnosticError(cyclic)).toEqual({ category: "unknown" });
});

it("does not break the application when logging storage is unavailable", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "noteboard-log-failure-"));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    writeFileSync(path.join(dir, "logs"), "not a directory");
    const log = new DiagnosticLog(dir);
    expect(() => {
      log.write({ event: "app.started" });
      log.write({ event: "app.stopping" });
    }).not.toThrow();
    expect(warning).toHaveBeenCalledOnce();
  } finally {
    warning.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  }
});
