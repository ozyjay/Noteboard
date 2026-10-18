import { afterEach, expect, it, vi } from "vitest";
import { chatGPTProvider } from "../electron/chatgpt";
import { chatGPTTransport } from "../electron/chatgpt-transport";
import { defaults } from "../src/core/model";
import type { GenerationRequest } from "../src/core/providers";
import { errorText } from "../src/features/workspace/browser-actions";

afterEach(() => vi.unstubAllGlobals());
const request: GenerationRequest = {
  id: "transport-test",
  purpose: "explore",
  settings: { ...defaults, provider: "chatgpt", model: "fixture" },
  messages: [{ role: "user", content: "A question" }],
};
const provider = () =>
  chatGPTProvider({ accessToken: async () => "synthetic-token" });
const signal = () => new AbortController().signal;
const event = (value: object) =>
  new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`);

it("reports an interrupted stream after partial output without replaying the request", async () => {
  let reads = 0;
  const fetcher = vi.fn(
    async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            if (reads++ === 0)
              controller.enqueue(
                event({ type: "response.output_text.delta", delta: "Partial" }),
              );
            else controller.error(new TypeError("terminated"));
          },
        }),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const delta = vi.fn();
  await expect(provider().generate(request, delta, signal())).rejects.toThrow(
    "connection to ChatGPT was interrupted",
  );
  expect(delta).toHaveBeenCalledWith("Partial");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("accepts a validated completion without waiting for the server to close its connection", async () => {
  const cancel = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                event({
                  type: "response.output_text.delta",
                  delta: "Complete",
                }),
              );
              controller.enqueue(
                event({
                  type: "response.completed",
                  response: { model: "fixture" },
                }),
              );
              // A keep-alive connection intentionally remains open.
            },
            cancel,
          }),
        ),
    ),
  );
  await expect(
    provider().generate(request, () => {}, signal()),
  ).resolves.toMatchObject({ text: "Complete" });
  expect(cancel).toHaveBeenCalledOnce();
});

it("reports failed connections without exposing the raw fetch exception", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("fetch failed");
    }),
  );
  await expect(
    provider().generate(request, () => {}, signal()),
  ).rejects.toThrow("Check your connection");
});

it("keeps HTTP rejection and malformed response errors distinct from transport failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: {} }, { status: 403 })),
  );
  await expect(
    provider().generate(request, () => {}, signal()),
  ).rejects.toThrow("plan access was denied");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("data: not JSON\n\n")),
  );
  await expect(
    provider().generate(request, () => {}, signal()),
  ).rejects.toBeInstanceOf(SyntaxError);
});

it("distinguishes cancellation and timeout from an interrupted connection", async () => {
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(
    chatGPTTransport(async () => {
      throw cancelled.signal.reason;
    }, cancelled.signal),
  ).rejects.toThrow("Generation cancelled");
  const timeout = new AbortController();
  timeout.abort(new DOMException("Expired", "TimeoutError"));
  await expect(
    chatGPTTransport(async () => {
      throw timeout.signal.reason;
    }, timeout.signal),
  ).rejects.toThrow("time limit");
});

it("removes Electron's invocation wrapper while preserving the actionable message", () => {
  expect(
    errorText(
      new Error(
        "Error invoking remote method 'provider:generate': Error: The connection was interrupted.",
      ),
    ),
  ).toBe("The connection was interrupted.");
  expect(errorText(new Error("ChatGPT plan access was denied."))).toBe(
    "ChatGPT plan access was denied.",
  );
});
