import { type Provider, type GenerationRequest } from "../src/core/providers";
import { type Settings } from "../src/core/model";
import { assertBudget } from "../src/core/context";
export function localEndpoint(raw: string) {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Use a local Ollama address, such as http://127.0.0.1:11434",
    );
  return url.origin;
}
async function checkedFetch(url: string, init: RequestInit) {
  try {
    const r = await fetch(url, init);
    if (!r.ok)
      throw new Error(
        `Ollama returned HTTP ${r.status}: ${(await r.text()).slice(0, 400)}`,
      );
    return r;
  } catch (e) {
    if (e instanceof TypeError)
      throw new Error(
        "Cannot connect to Ollama. Start Ollama and check the local address in provider settings.",
      );
    throw e;
  }
}
export const ollamaProvider: Provider = {
  id: "ollama",
  capabilities: {
    streaming: true,
    modelDiscovery: true,
    authentication: "none",
  },
  async models(settings: Settings, signal) {
    const r = await checkedFetch(
      `${localEndpoint(settings.endpoint)}/api/tags`,
      { signal: signal || AbortSignal.timeout(10000) },
    );
    const data = await r.json();
    return data.models
      .filter(
        (m: { capabilities?: string[] }) =>
          !m.capabilities || m.capabilities.includes("completion"),
      )
      .map((m: { name: string }) => m.name);
  },
  async generate(req: GenerationRequest, onDelta, signal) {
    if (!req.settings.model.trim())
      throw new Error("Choose an installed Ollama model in provider settings");
    const base = localEndpoint(req.settings.endpoint);
    const combined = AbortSignal.any([signal, AbortSignal.timeout(600000)]);
    const show = await checkedFetch(`${base}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: req.settings.model }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
    const info = await show.json();
    const maximum = Object.entries(info.model_info || {}).find(([key]) =>
      key.endsWith(".context_length"),
    )?.[1];
    if (typeof maximum === "number" && req.settings.contextLimit > maximum)
      throw new Error(
        `This model supports ${maximum.toLocaleString()} context tokens. Lower the configured budget or choose a larger model.`,
      );
    assertBudget(req.messages, req.settings.contextLimit);
    const r = await checkedFetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.settings.model,
        messages: req.messages,
        stream: true,
        ...(info.capabilities?.includes("thinking") ? { think: false } : {}),
        options: { num_ctx: req.settings.contextLimit, num_predict: 1024 },
      }),
      signal: combined,
    });
    if (!r.body) throw new Error("Ollama returned no response stream");
    const reader = r.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "",
      text = "",
      done = false;
    let usage: { input?: number; output?: number } | undefined;
    function consume(line: string) {
      if (!line.trim()) return;
      const item = JSON.parse(line);
      if (item.error) throw new Error(item.error);
      const delta = item.message?.content || "";
      text += delta;
      if (delta) onDelta(delta);
      if (item.done) {
        done = true;
        usage = { input: item.prompt_eval_count, output: item.eval_count };
      }
    }
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) consume(line);
      }
      buffer += decoder.decode();
      consume(buffer);
      if (!done)
        throw new Error(
          "Ollama stream ended before completion. Retry the question.",
        );
      if (!text.trim()) throw new Error("The model returned an empty response");
      return { text, model: req.settings.model, usage };
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  },
};
