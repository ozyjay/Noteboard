import { describe, it, expect } from "vitest";
import { createServer, type ServerResponse } from "node:http";
import { ollamaProvider, localEndpoint } from "../electron/ollama";
import { demoProvider, type GenerationRequest } from "../src/core/providers";
import { defaults, uid } from "../src/core/model";
async function server(chat: (r: ServerResponse) => void) {
  const received: unknown[] = [];
  const s = createServer((req, res) => {
    let data = "";
    req.on("data", (d) => (data += d));
    req.on("end", () => {
      if (req.url === "/api/show") {
        res.end(
          JSON.stringify({ model_info: { "test.context_length": 8192 } }),
        );
      } else if (req.url === "/api/tags")
        res.end(
          JSON.stringify({
            models: [
              { name: "test-model", capabilities: ["completion"] },
              { name: "embedding-only", capabilities: ["embedding"] },
            ],
          }),
        );
      else {
        received.push(JSON.parse(data));
        chat(res);
      }
    });
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const address = s.address();
  if (typeof address !== "object" || !address) throw new Error("No server");
  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    received,
    close: () =>
      new Promise<void>((r) => {
        s.closeAllConnections();
        s.close(() => r());
      }),
  };
}
const req = (endpoint: string): GenerationRequest => ({
  id: uid(),
  purpose: "explore",
  messages: [
    { role: "system", content: "Help" },
    { role: "user", content: "Explain this" },
  ],
  settings: { ...defaults, provider: "ollama", endpoint, model: "test-model" },
});
describe("providers", () => {
  it("streams split NDJSON and preserves effective messages and usage", async () => {
    const s = await server((r) => {
      r.write('{"message":{"content":"Hel');
      setTimeout(
        () =>
          r.end(
            'lo"},"done":false}\n{"message":{"content":" world"},"done":true,"prompt_eval_count":8,"eval_count":2}\n',
          ),
        5,
      );
    });
    try {
      const parts: string[] = [];
      const request = req(s.endpoint);
      const result = await ollamaProvider.generate(
        request,
        (t) => parts.push(t),
        new AbortController().signal,
      );
      expect(result.text).toBe("Hello world");
      expect(parts).toEqual(["Hello", " world"]);
      expect(result.usage).toEqual({ input: 8, output: 2 });
      expect(s.received[0]).toMatchObject({
        messages: request.messages,
        options: { num_ctx: 8192, num_predict: 1024 },
      });
      expect(await ollamaProvider.models(request.settings)).toEqual([
        "test-model",
      ]);
    } finally {
      await s.close();
    }
  });
  it("rejects incomplete streams and model context limits", async () => {
    const s = await server((r) => r.end('{"message":{"content":"Partial"}}\n'));
    try {
      await expect(
        ollamaProvider.generate(
          req(s.endpoint),
          () => {},
          new AbortController().signal,
        ),
      ).rejects.toThrow(/before completion/);
      const request = req(s.endpoint);
      request.settings.contextLimit = 16000;
      await expect(
        ollamaProvider.generate(
          request,
          () => {},
          new AbortController().signal,
        ),
      ).rejects.toThrow(/supports 8,192/);
    } finally {
      await s.close();
    }
  });
  it("reports provider errors and honours cancellation", async () => {
    const errors = await server((r) =>
      r.end('{"error":"model unavailable"}\n'),
    );
    try {
      await expect(
        ollamaProvider.generate(
          req(errors.endpoint),
          () => {},
          new AbortController().signal,
        ),
      ).rejects.toThrow("model unavailable");
    } finally {
      await errors.close();
    }
    const s = await server((r) =>
      r.write('{"message":{"content":"First"},"done":false}\n'),
    );
    const controller = new AbortController();
    try {
      await expect(
        ollamaProvider.generate(
          req(s.endpoint),
          () => controller.abort(),
          controller.signal,
        ),
      ).rejects.toThrow();
    } finally {
      await s.close();
    }
  });
  it("restricts Ollama endpoints to local inference", () => {
    expect(localEndpoint("http://127.0.0.1:11434")).toBe(
      "http://127.0.0.1:11434",
    );
    for (const url of [
      "https://example.com",
      "file:///tmp/x",
      "http://user:secret@localhost:11434",
      "http://localhost:11434/proxy",
    ])
      expect(() => localEndpoint(url)).toThrow();
  });
  it("labels demo responses and can abort without committing a response", async () => {
    const request = req("http://localhost");
    request.settings.provider = "demo";
    const controller = new AbortController();
    controller.abort();
    await expect(
      demoProvider.generate(request, () => {}, controller.signal),
    ).rejects.toThrow(/cancelled/);
    const result = await demoProvider.generate(
      request,
      () => {},
      new AbortController().signal,
    );
    expect(result.model).toBe("synthetic-demo");
    expect(result.text).toContain("synthetic response");
  });
});
