import { z } from "zod";
import { type Provider, validateRequestFeatures } from "../src/core/providers";
import {
  SearchCallSchema,
  CitationSchema,
  type WebResearch,
} from "../src/core/research";
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
      "ChatGPT rejected the request. Check the model, thinking effort, web search availability and attached file support. Try Model default or explicitly disable search if unsupported. No completed response was saved.",
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
      supported_reasoning_levels: z
        .array(
          z.object({
            effort: z.string().min(1).max(40),
            description: z.string().max(2000).optional(),
          }),
        )
        .max(100)
        .nullish(),
      default_reasoning_level: z.string().min(1).max(40).nullish(),
    }),
  ),
});
const Event = z.object({
  type: z.string(),
  delta: z.string().optional(),
  item: z.object({ type: z.string() }).optional(),
  code: z.string().optional(),
  response: z
    .object({
      model: z.string().optional(),
      output: z.array(z.unknown()).optional(),
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
        .map((m) => ({
          id: m.slug,
          name: m.display_name,
          ...(m.supported_reasoning_levels != null
            ? { reasoningEfforts: m.supported_reasoning_levels }
            : {}),
          ...(m.default_reasoning_level != null
            ? { defaultReasoningEffort: m.default_reasoning_level }
            : {}),
        }));
    },
    async generate(req, onDelta, signal, onProgress) {
      signal.throwIfAborted();
      validateRequestFeatures(req);
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
          input: req.messages.map(({ role, content, files }) =>
            files?.length
              ? {
                  role,
                  content: [
                    { type: "input_text", text: content },
                    ...files.map((file) => ({
                      type: "input_file",
                      filename: file.name,
                      file_data: file.data,
                    })),
                  ],
                }
              : { role, content },
          ),
          store: false,
          stream: true,
          ...(req.settings.webSearch
            ? {
                tools: [{ type: "web_search" }],
                include: ["web_search_call.action.sources"],
              }
            : {}),
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
      let webResearch: WebResearch | undefined;
      function consume(block: string) {
        const data = block
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") return;
        const event = Event.parse(JSON.parse(data));
        if (
          event.type === "response.created" ||
          event.type === "response.in_progress"
        )
          onProgress?.("working");
        if (
          event.type === "response.output_item.added" &&
          event.item?.type === "reasoning"
        )
          onProgress?.("thinking");
        if (event.type === "response.reasoning_summary_text.delta")
          onProgress?.("thinking");
        if (
          event.type === "response.web_search_call.in_progress" ||
          event.type === "response.web_search_call.searching"
        )
          onProgress?.("searching");
        if (event.type === "response.web_search_call.completed")
          onProgress?.("working");
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
          if (event.response.output) {
            const research: WebResearch = {
              requested: Boolean(req.settings.webSearch),
              searched: false,
              calls: [],
              citations: [],
            };
            let finalText = "";
            for (const raw of event.response.output) {
              const item = z
                .object({ type: z.string() })
                .passthrough()
                .parse(raw);
              if (item.type === "web_search_call") {
                const call = SearchCallSchema.parse(item);
                research.calls.push(call);
                if (call.status === "completed") research.searched = true;
              }
              if (item.type === "message") {
                const message = z
                  .object({
                    content: z.array(
                      z.object({
                        type: z.string(),
                        text: z.string().optional(),
                        annotations: z.array(z.unknown()).optional(),
                      }),
                    ),
                  })
                  .parse(item);
                for (const part of message.content) {
                  if (part.type !== "output_text" || part.text === undefined)
                    continue;
                  const offset = finalText.length;
                  finalText += part.text;
                  for (const rawAnnotation of part.annotations ?? []) {
                    const annotation = z
                      .object({ type: z.string() })
                      .passthrough()
                      .parse(rawAnnotation);
                    if (annotation.type !== "url_citation") continue;
                    const data = z
                      .object({
                        url: z.string(),
                        title: z.string(),
                        start_index: z.number(),
                        end_index: z.number(),
                      })
                      .parse(annotation);
                    const citation = CitationSchema.parse({
                      url: data.url,
                      title: data.title,
                      start: offset + data.start_index,
                      end: offset + data.end_index,
                    });
                    if (citation.end > finalText.length)
                      throw new Error(
                        "ChatGPT returned an invalid citation range",
                      );
                    research.citations.push(citation);
                  }
                }
              }
            }
            if (finalText) {
              if (text && text !== finalText)
                throw new Error(
                  "ChatGPT response text did not match its completed record",
                );
              text = finalText;
            }
            if (
              req.settings.webSearch ||
              research.calls.length ||
              research.citations.length
            )
              webResearch = research;
          }
          if (req.settings.webSearch && !webResearch)
            webResearch = {
              requested: true,
              searched: false,
              calls: [],
              citations: [],
            };
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
          ...(webResearch ? { webResearch } : {}),
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
