import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AttachmentSchema,
  AttachmentsSchema,
  WebUrlSchema,
  citationMarkdown,
  type Attachment,
} from "../src/core/research";
import {
  buildContext,
  revisionContext,
  improvementContext,
  estimateTokens,
} from "../src/core/context";
import { exampleBoard } from "../src/core/example";
import { defaults, response, uid, now, validateBoard } from "../src/core/model";
import { appendRevision } from "../src/core/revisions";
import {
  providerMessages,
  validateRequestFeatures,
} from "../src/core/providers";
import { Store } from "../electron/store";

const file: Attachment = {
  name: "reference.txt",
  size: 5,
  data: "data:text/plain;base64,SGVsbG8=",
};
it("validates inline bytes, supported types, limits and external citation URLs", () => {
  expect(AttachmentSchema.parse(file)).toEqual(file);
  for (const invalid of [
    { ...file, size: 6 },
    { ...file, name: "../file.txt" },
    { ...file, name: "file.exe" },
    { ...file, data: "data:text/plain;base64,not base64" },
    { ...file, data: "data:application/pdf;base64,SGVsbG8=" },
  ])
    expect(AttachmentSchema.safeParse(invalid).success).toBe(false);
  expect(AttachmentsSchema.safeParse(Array(6).fill(file)).success).toBe(false);
  for (const url of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:secret@example.org",
    "https://example.org\n/path",
  ])
    expect(WebUrlSchema.safeParse(url).success).toBe(false);
  const text = "Evidence [source]";
  expect(
    citationMarkdown(text, [
      {
        start: 9,
        end: 17,
        url: "https://example.org/evidence",
        title: "Evidence",
      },
    ]),
  ).toBe("Evidence [[1]](https://example.org/evidence)");
  expect(text).toBe("Evidence [source]");
  expect(
    citationMarkdown("A supported claim.", [
      {
        start: 0,
        end: 18,
        url: "https://example.org/evidence",
        title: "Evidence",
      },
    ]),
  ).toBe("A supported claim. [[1]](https://example.org/evidence)");
});
it("retains files and web provenance across context, reviews, schema migration and SQLite reopening", () => {
  let board = exampleBoard();
  const root = board.notes[0];
  const version = response(root);
  if (version.origin !== "generated")
    throw new Error("Expected generated fixture");
  version.files = [file];
  version.context.at(-1)!.files = [file];
  version.webResearch = {
    requested: true,
    searched: true,
    calls: [
      {
        id: "search-1",
        status: "completed",
        action: { type: "search", queries: ["evidence"] },
      },
    ],
    citations: [
      {
        start: 0,
        end: 2,
        url: "https://example.org/evidence",
        title: "Evidence",
      },
    ],
  };
  const h = board.edges[0].highlight!;
  const context = buildContext(board, "A new branch", h, "");
  expect(context[1].files).toEqual([file]);
  expect(context[2].content).toContain("Recorded web sources:");
  expect(context[2].content).toContain("https://example.org/evidence");
  expect(context.map((m) => m.content)).not.toContain(board.notes[2].prompt);
  const review = improvementContext(
    board,
    root.id,
    version.id,
    "Review it",
    "",
  );
  expect(review.messages[1].files).toEqual([file]);
  expect(review.messages.at(-2)?.content).toContain(version.text);
  const regenerated = revisionContext(
    board,
    root.id,
    version.id,
    root.prompt,
    "",
  );
  expect(regenerated.messages.at(-1)?.files).toEqual([file]);
  const reviewVersion = {
    ...version,
    id: uid(),
    text: "Reviewed answer",
    context: review.messages,
    basedOnVersionId: version.id,
    ancestryVersions: {},
  };
  const reviewedBoard = appendRevision(board, root.id, reviewVersion);
  const reviewedRequest = revisionContext(
    reviewedBoard,
    root.id,
    reviewVersion.id,
    "Revised question",
    "",
  );
  expect(reviewedRequest.messages.at(-1)?.content).toBe("Revised question");
  expect(reviewedRequest.messages.at(-1)?.files).toEqual([file]);
  expect(estimateTokens(context)).toBeGreaterThan(
    estimateTokens(context.map(({ files: _files, ...m }) => m)),
  );
  board = appendRevision(board, root.id, {
    ...version,
    id: uid(),
    createdAt: now(),
    text: "Updated",
    webResearch: undefined,
    basedOnVersionId: version.id,
    ancestryVersions: {},
  });
  const migration = validateBoard({ ...board, schemaVersion: 3 });
  expect(migration.schemaVersion).toBe(4);
  expect(migration.notes[0].versions[0]).toEqual(version);
  const dir = mkdtempSync(path.join(tmpdir(), "noteboard-research-"));
  try {
    let store = new Store(path.join(dir, "board.sqlite"));
    store.save(board);
    store.close();
    store = new Store(path.join(dir, "board.sqlite"));
    expect(store.list()).toEqual([board]);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it("never drops files when a request targets an unsupported provider", () => {
  const messages = [
    { role: "user" as const, content: "Question", files: [file] },
  ];
  expect(() =>
    validateRequestFeatures({
      id: uid(),
      messages,
      settings: defaults,
      purpose: "explore",
    }),
  ).toThrow(/No files or context have been removed/);
  expect(messages[0].files).toEqual([file]);
  const effective = providerMessages(
    buildContext(exampleBoard(), "Question"),
    "chatgpt",
    true,
  );
  expect(effective[0].role).toBe("developer");
  expect(effective[0].content).toContain("Web search is available");
  expect(effective[0].content).not.toContain("No web search, browsing");
});
