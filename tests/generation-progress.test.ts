import { afterEach, expect, it, vi } from "vitest";
import { chatGPTProvider } from "../electron/chatgpt";
import { ollamaProvider } from "../electron/ollama";
import { defaults } from "../src/core/model";
import { GenerationProgressSchema } from "../src/core/generation-progress";

afterEach(() => vi.unstubAllGlobals());

it("reports Ollama activity without adding thinking chunks to the answer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("/api/show")
        ? Response.json({ model_info: { "test.context_length": 8192 } })
        : new Response(
            [
              { message: { thinking: "Internal processing" }, done: false },
              { message: { content: "Answer" }, done: true },
            ]
              .map((item) => JSON.stringify(item))
              .join("\n") + "\n",
          ),
    ),
  );
  const activity: string[] = [];
  const text: string[] = [];
  const result = await ollamaProvider.generate(
    {
      id: "test",
      purpose: "explore",
      settings: { ...defaults, provider: "ollama", model: "local-test" },
      messages: [{ role: "user", content: "Question" }],
    },
    (delta) => text.push(delta),
    new AbortController().signal,
    (status) => activity.push(status),
  );
  expect(activity).toEqual(["working", "thinking"]);
  expect(text).toEqual(["Answer"]);
  expect(result.text).toBe("Answer");
});

it("forwards reported reasoning and search activity separately from answer text", async () => {
  const events = [
    { type: "response.created" },
    { type: "response.output_item.added", item: { type: "reasoning" } },
    { type: "response.reasoning_summary_text.delta", delta: "Private summary" },
    { type: "response.web_search_call.in_progress" },
    { type: "response.web_search_call.searching" },
    { type: "response.web_search_call.completed" },
    { type: "response.output_text.delta", delta: "Visible answer" },
    { type: "response.completed", response: { model: "test-model" } },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
        ),
    ),
  );
  const activity: string[] = [];
  const text: string[] = [];
  const result = await chatGPTProvider({
    accessToken: async () => "synthetic-token",
  }).generate(
    {
      id: "test",
      purpose: "explore",
      settings: { ...defaults, provider: "chatgpt", model: "test-model" },
      messages: [{ role: "user", content: "Question" }],
    },
    (delta) => text.push(delta),
    new AbortController().signal,
    (status) => activity.push(status),
  );
  expect(activity).toEqual([
    "working",
    "thinking",
    "thinking",
    "searching",
    "searching",
    "working",
  ]);
  expect(text).toEqual(["Visible answer"]);
  expect(result.text).toBe("Visible answer");
  expect(JSON.stringify(result)).not.toContain("Private summary");
});

it("rejects malformed or invented progress at the bridge boundary", () => {
  expect(
    GenerationProgressSchema.safeParse({ id: "request", activity: "thinking" })
      .success,
  ).toBe(true);
  for (const data of [
    { id: "", activity: "thinking" },
    { id: "request", activity: "reading" },
    { id: 7, activity: "writing" },
  ]) {
    expect(GenerationProgressSchema.safeParse(data).success).toBe(false);
  }
});
