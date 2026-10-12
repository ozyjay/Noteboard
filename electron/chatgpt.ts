import { z } from "zod";
import { type Provider } from "../src/core/providers";
import { assertBudget } from "../src/core/context";
import { type ChatGPTAuth } from "./chatgpt-auth";
const base = "https://api.openai.com/v1";
function failure(status: number, code?: unknown) {
  if (code === "subscription_sharing_usage_limit_exceeded" || status === 429)
    return new Error(
      "ChatGPT usage limit reached. Manage usage in ChatGPT settings before trying again.",
    );
  if (code === "subscription_sharing_user_not_eligible")
    return new Error(
      "This ChatGPT account or workspace is not eligible for plan usage.",
    );
  if (status === 401)
    return new Error(
      "ChatGPT authorisation was not accepted. Check your account and sign in again.",
    );
  if (status === 403)
    return new Error(
      "ChatGPT plan access was denied. Check account permissions and availability.",
    );
  if (status === 400)
    return new Error(
      "ChatGPT rejected the request. Check the selected model and thinking effort in provider settings; try Model default if that effort is unsupported. No completed response was saved.",
    );
  return new Error(
    `ChatGPT request failed${status ? ` (HTTP ${status})` : ""}. No completed response was saved. Try again later.`,
  );
}
async function checked(url: string, token: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    redirect: "error",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw failure(response.status, data.error?.code);
  }
  return response;
}
const ModelCatalog = z.object({
  models: z.array(
    z.object({
      slug: z.string().min(1),
      display_name: z.string(),
      visibility: z.string(),
    }),
  ),
});
const Event = z.object({
  type: z.string(),
  delta: z.string().optional(),
  code: z.string().optional(),
  response: z
    .object({
      model: z.string().optional(),
      error: z.object({ code: z.string().optional() }).nullish(),
      usage: z
        .object({
          input_tokens: z.number().nonnegative().optional(),
          output_tokens: z.number().nonnegative().optional(),
        })
        .nullish(),
    })
    .optional(),
});
export function chatGPTProvider(
  auth: Pick<ChatGPTAuth, "accessToken">,
): Provider {
  return {
    id: "chatgpt",
    capabilities: {
      streaming: true,
      modelDiscovery: true,
      authentication: "oauth",
    },
    async models(settings, signal) {
      const token = await auth.accessToken(settings.chatgptAccountId);
      const response = await checked(`${base}/models`, token, {
        signal: signal || AbortSignal.timeout(15000),
      });
      return ModelCatalog.parse(await response.json())
        .models.filter((m) => m.visibility === "list")
        .map((m) => ({ id: m.slug, name: m.display_name }));
    },
    async generate(req, onDelta, signal) {
      signal.throwIfAborted();
      assertBudget(req.messages, req.settings.contextLimit);
      if (!req.settings.model.trim())
        throw new Error(
          "Discover and choose a ChatGPT model in provider settings",
        );
      if (req.messages.some((m) => m.role === "system"))
        throw new Error(
          "ChatGPT requests require developer messages. Prepare and record the effective context first.",
        );
      const token = await auth.accessToken(req.settings.chatgptAccountId);
      signal.throwIfAborted();
      const response = await checked(`${base}/responses`, token, {
        method: "POST",
        signal: AbortSignal.any([signal, AbortSignal.timeout(600000)]),
        body: JSON.stringify({
          model: req.settings.model,
          input: req.messages,
          store: false,
          stream: true,
          ...(req.settings.reasoningEffort
            ? { reasoning: { effort: req.settings.reasoningEffort } }
            : {}),
        }),
      });
      if (!response.body)
        throw new Error("ChatGPT returned no response stream");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        text = "",
        completed = false,
        model = req.settings.model;
      let usage: { input?: number; output?: number } | undefined;
      function consume(block: string) {
        const data = block
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") return;
        const event = Event.parse(JSON.parse(data));
        if (event.type === "response.failed" || event.type === "error")
          throw failure(0, event.response?.error?.code || event.code);
        if (event.type === "response.incomplete")
          throw new Error(
            "ChatGPT could not complete this response. No Note or document was created.",
          );
        if (event.type === "response.output_text.delta") {
          if (completed || event.delta === undefined)
            throw new Error("Invalid ChatGPT response stream");
          text += event.delta;
          onDelta(event.delta);
        }
        if (event.type === "response.completed") {
          if (!event.response || completed)
            throw new Error("Invalid ChatGPT completion event");
          completed = true;
          model = event.response.model || model;
          if (event.response.usage)
            usage = {
              input: event.response.usage.input_tokens,
              output: event.response.usage.output_tokens,
            };
        }
      }
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          // Normalise CRLF after decoding; a CR split between chunks stays buffered.
          buffer = buffer.replace(/\r\n/g, "\n");
          let index;
          while ((index = buffer.indexOf("\n\n")) >= 0) {
            consume(buffer.slice(0, index));
            buffer = buffer.slice(index + 2);
          }
          if (buffer.length > 8 * 1024 * 1024)
            throw new Error("ChatGPT stream event is too large");
        }
        buffer += decoder.decode();
        if (buffer.trim()) consume(buffer);
        signal.throwIfAborted();
        if (!completed)
          throw new Error(
            "ChatGPT stream ended before completion. Retry the question.",
          );
        if (!text.trim()) throw new Error("ChatGPT returned an empty response");
        return {
          text,
          model,
          usage,
          ...(req.settings.reasoningEffort
            ? { reasoningEffort: req.settings.reasoningEffort }
            : {}),
        };
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    },
  };
}
