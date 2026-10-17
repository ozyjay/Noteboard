import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const extensions = new Set([
  ".ts",
  ".tsx",
  ".css",
  ".mjs",
  ".ps1",
  ".mm",
  ".h",
]);
const exceptions = JSON.parse(
  readFileSync(new URL("./file-size-exceptions.json", import.meta.url), "utf8"),
);
const checking = process.argv.includes("--check");

function files(directory) {
  return readdirSync(path.join(root, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const filename = `${directory}/${entry.name}`;
    return entry.isDirectory()
      ? files(filename)
      : extensions.has(path.extname(filename))
        ? [filename]
        : [];
  });
}

const rows = ["src", "electron", "scripts", "tests"]
  .flatMap(files)
  .map((filename) => {
    const text = readFileSync(path.join(root, filename), "utf8");
    const lines = text
      ? text.split("\n").length - Number(text.endsWith("\n"))
      : 0;
    return { filename, lines, exception: exceptions[filename] };
  })
  .sort(
    (left, right) =>
      right.lines - left.lines || left.filename.localeCompare(right.filename),
  );

console.log(
  "Authored files over 400 physical lines (500 requires a documented exception):",
);
for (const row of rows.filter((row) => row.lines > 400)) {
  console.log(
    `${String(row.lines).padStart(4)}  ${row.filename}${row.exception ? ` — ${row.exception.reason}` : ""}`,
  );
}
const failures = rows.filter(
  (row) => row.lines > (row.exception?.maxLines ?? 500),
);
const stale = Object.keys(exceptions).filter(
  (filename) => !rows.some((row) => row.filename === filename),
);
if (checking && (failures.length || stale.length)) {
  for (const row of failures)
    console.error(
      `Review ${row.filename}: ${row.lines} lines exceeds ${row.exception?.maxLines ?? 500}. Split responsibilities or document a credible exception.`,
    );
  for (const filename of stale)
    console.error(`Remove the stale exception for ${filename}.`);
  process.exitCode = 1;
}
