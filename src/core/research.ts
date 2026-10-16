import { z } from "zod";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_REQUEST_FILE_BYTES = 10 * 1024 * 1024;
export const fileTypes: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  html: "text/html",
  xml: "application/xml",
};
export const fileAccept = Object.keys(fileTypes)
  .map((ext) => `.${ext}`)
  .join(",");
export const AttachmentSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(255)
      .refine((name) => !/[\x00-\x1f/\\]/.test(name), "Invalid filename"),
    size: z.number().int().positive().max(MAX_FILE_BYTES),
    data: z.string().max(Math.ceil(MAX_FILE_BYTES / 3) * 4 + 200),
  })
  .superRefine((file, ctx) => {
    const mime = fileTypes[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
    const prefix = `data:${mime};base64,`;
    const encoded = file.data.slice(prefix.length);
    const size =
      (encoded.length * 3) / 4 -
      (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
    if (
      !mime ||
      !file.data.startsWith(prefix) ||
      encoded.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
      size !== file.size
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid file type, base64 data or byte count",
      });
  });
export type Attachment = z.infer<typeof AttachmentSchema>;
export const AttachmentsSchema = z
  .array(AttachmentSchema)
  .max(5)
  .refine(
    (files) =>
      files.reduce((sum, file) => sum + file.size, 0) <= MAX_REQUEST_FILE_BYTES,
    "Attachments exceed the 10 MB request limit",
  );
export const WebUrlSchema = z
  .string()
  .max(4096)
  .refine((value) => {
    if (!/^https?:\/\//i.test(value) || /[\x00-\x20]/.test(value)) return false;
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Only HTTP and HTTPS links without credentials are allowed");
export const CitationSchema = z
  .object({
    url: WebUrlSchema,
    title: z.string().max(2000),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .refine(
    (citation) => citation.end > citation.start,
    "Invalid citation range",
  );
export type Citation = z.infer<typeof CitationSchema>;
export const SearchCallSchema = z.object({
  id: z.string().max(200),
  status: z.string().max(40).optional(),
  action: z
    .object({
      type: z.string().max(40),
      query: z.string().max(10000).optional(),
      queries: z.array(z.string().max(10000)).max(100).optional(),
      url: WebUrlSchema.optional(),
      pattern: z.string().max(10000).optional(),
      sources: z
        .array(
          z.object({
            url: WebUrlSchema,
            title: z.string().max(2000).optional(),
            type: z.string().max(40).optional(),
          }),
        )
        .max(1000)
        .optional(),
    })
    .optional(),
});
export const WebResearchSchema = z.object({
  requested: z.boolean(),
  searched: z.boolean(),
  calls: z.array(SearchCallSchema).max(1000),
  citations: z.array(CitationSchema).max(1000),
});
export type WebResearch = z.infer<typeof WebResearchSchema>;

export function combineFiles(
  ...groups: (Attachment[] | undefined)[]
): Attachment[] {
  const files: Attachment[] = [];
  for (const file of groups.flatMap((group) => group ?? []))
    if (
      !files.some(
        (existing) =>
          existing.name === file.name && existing.data === file.data,
      )
    )
      files.push(file);
  return AttachmentsSchema.parse(files);
}

export function citationMarkdown(text: string, citations: Citation[] = []) {
  let result = text;
  let boundary = text.length;
  const ordered = citations
    .map((citation, index) => ({ ...citation, index }))
    .sort((a, b) => b.end - a.end);
  for (const citation of ordered) {
    if (
      citation.end > boundary ||
      citation.end > text.length ||
      !WebUrlSchema.safeParse(citation.url).success
    )
      continue;
    const span = text.slice(citation.start, citation.end);
    const marker =
      /^\[(?:source|\d+)\]$/i.test(span) ||
      (span.startsWith("\uE200cite") && span.endsWith("\uE201"));
    const link = `[[${citation.index + 1}]](${new URL(citation.url).href.replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
    // Annotations can cover prose. Replace only standalone citation markers.
    const start = marker ? citation.start : citation.end;
    result =
      result.slice(0, start) +
      (marker ? link : ` ${link}`) +
      result.slice(citation.end);
    boundary = start;
  }
  return result;
}
