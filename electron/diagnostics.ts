import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { z } from "zod";

const errorCodes = [
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "ABORT_ERR",
] as const;
const ErrorSummary = z.object({
  category: z.enum([
    "connection",
    "timeout",
    "cancelled",
    "usage-limit",
    "access",
    "validation",
    "unknown",
  ]),
  code: z.enum(errorCodes).optional(),
});
const Entry = z.object({
  event: z.enum([
    "app.started",
    "app.stopping",
    "app.error",
    "ipc.completed",
    "ipc.failed",
    "generation.started",
    "generation.completed",
    "generation.failed",
    "renderer.exited",
    "renderer.unresponsive",
  ]),
  operation: z
    .enum([
      "chatgpt:accounts",
      "chatgpt:signin",
      "chatgpt:cancel",
      "chatgpt:signout",
      "chatgpt:usage",
      "web:open",
      "boards:list",
      "boards:save",
      "boards:delete",
      "settings:get",
      "settings:save",
      "provider:models",
      "provider:generate",
      "provider:cancel",
      "diagnostics:open",
      "uncaught-exception",
    ])
    .optional(),
  durationMs: z.number().nonnegative().optional(),
  provider: z.enum(["demo", "ollama", "chatgpt"]).optional(),
  purpose: z.enum(["explore", "synthesis"]).optional(),
  requestId: z.string().uuid().optional(),
  messageCount: z.number().int().nonnegative().optional(),
  webSearch: z.boolean().optional(),
  appVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/)
    .optional(),
  platform: z
    .enum([
      "darwin",
      "win32",
      "linux",
      "aix",
      "freebsd",
      "openbsd",
      "sunos",
      "android",
      "haiku",
      "cygwin",
      "netbsd",
    ])
    .optional(),
  error: ErrorSummary.optional(),
});
export type DiagnosticEntry = z.infer<typeof Entry>;

// Inspect messages to classify the failure, but never persist raw messages,
// stacks, paths, request arguments, URLs or arbitrary provider error payloads.
export function diagnosticError(error: unknown): z.infer<typeof ErrorSummary> {
  const seen = new Set<unknown>();
  let current = error;
  let code: (typeof errorCodes)[number] | undefined;
  let category: z.infer<typeof ErrorSummary>["category"] = "unknown";
  for (let depth = 0; current && depth < 5 && !seen.has(current); depth++) {
    seen.add(current);
    if (typeof current !== "object") break;
    const value = current as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      cause?: unknown;
    };
    if (errorCodes.includes(value.code as (typeof errorCodes)[number]))
      code = value.code as (typeof errorCodes)[number];
    const text = typeof value.message === "string" ? value.message : "";
    if (category === "unknown") {
      if (value.name === "TimeoutError" || /time limit|timed? ?out/i.test(text))
        category = "timeout";
      else if (value.name === "AbortError" || /cancelled/i.test(text))
        category = "cancelled";
      else if (/connection|terminated|fetch failed/i.test(text))
        category = "connection";
      else if (/usage limit/i.test(text)) category = "usage-limit";
      else if (/authorisation|denied|not eligible|sign in/i.test(text))
        category = "access";
      else if (
        value.name === "ZodError" ||
        /invalid|rejected|budget|exceeds/i.test(text)
      )
        category = "validation";
    }
    current = value.cause;
  }
  return { category, ...(code ? { code } : {}) };
}

export class DiagnosticLog {
  readonly directory: string;
  private warned = false;
  constructor(
    userData: string,
    private readonly maxBytes = 1024 * 1024,
  ) {
    this.directory = path.join(userData, "logs");
  }
  ensureDirectory() {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
  }
  write(entry: DiagnosticEntry) {
    try {
      const safe = Entry.parse(entry); // Unknown fields are discarded at runtime.
      this.ensureDirectory();
      const filename = path.join(this.directory, "diagnostics.jsonl");
      const line =
        JSON.stringify({ timestamp: new Date().toISOString(), ...safe }) + "\n";
      if (
        existsSync(filename) &&
        statSync(filename).size + Buffer.byteLength(line) > this.maxBytes
      ) {
        rmSync(`${filename}.2`, { force: true });
        if (existsSync(`${filename}.1`))
          renameSync(`${filename}.1`, `${filename}.2`);
        renameSync(filename, `${filename}.1`);
      }
      appendFileSync(filename, line, { mode: 0o600 });
    } catch {
      // Logging must never interrupt generation or persistence.
      if (!this.warned)
        console.warn("Noteboard diagnostic logging is unavailable.");
      this.warned = true;
    }
  }
}
