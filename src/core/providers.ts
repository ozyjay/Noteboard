import { type Message, type Settings, type ReasoningEffort } from "./model";
export interface GenerationRequest {
  id: string;
  messages: Message[];
  settings: Settings;
  purpose: "explore" | "synthesis";
}
export interface GenerationResult {
  text: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
  usage?: { input?: number; output?: number };
}
export type ModelChoice = string | { id: string; name: string };
export interface Provider {
  id: string;
  capabilities: {
    streaming: boolean;
    modelDiscovery: boolean;
    authentication: "none" | "oauth";
  };
  models(settings: Settings, signal?: AbortSignal): Promise<ModelChoice[]>;
  generate(
    request: GenerationRequest,
    onDelta: (text: string) => void,
    signal: AbortSignal,
  ): Promise<GenerationResult>;
}
const abort = () => new DOMException("Generation cancelled", "AbortError");
export const demoProvider: Provider = {
  id: "demo",
  capabilities: {
    streaming: true,
    modelDiscovery: false,
    authentication: "none",
  },
  async models() {
    return ["synthetic-demo"];
  },
  async generate(request, onDelta, signal) {
    const last = request.messages.at(-1)?.content || "";
    let text: string;
    if (request.purpose === "synthesis") {
      const sources = request.messages[1].content;
      const notes = [
        ...sources.matchAll(
          /<note id="([^"]+)">\nPrompt: ([\s\S]*?)\nResponse:\n([\s\S]*?)\n<\/note>/g,
        ),
      ];
      text =
        "# Exploration overview\n\n> Synthetic demonstration: this groups source takeaways; it is not a model-generated integrated explanation.\n\n" +
        notes
          .map(
            (m) =>
              `## ${m[2]}\n\n${m[3].match(/Takeaway:\s*([^\n]+)/)?.[1] || m[3].split("\n\n")[0]}\n\n[Source Note](inquiry://note/${m[1]})`,
          )
          .join("\n\n") +
        "\n\n## Questions to revisit\n\nCheck the evidence and qualifications in each source Note before drawing conclusions.";
    } else if (/emerg|complex|systems/i.test(last)) {
      text =
        "## How complex systems come together\n\nA complex system is made of interacting parts whose collective behaviour can be difficult to predict from the parts alone. **Emergence** describes patterns that arise from those local interactions.\n\nFor example, a flock of birds forms a coordinated shape even though each bird responds mainly to its neighbours. Feedback loops can amplify small changes or stabilise the whole system.\n\n### A useful distinction\n\nComplex does not simply mean complicated. A complicated mechanism can often be understood by taking it apart; a complex system also depends on relationships and changing context.\n\nThese examples are illustrative, rather than evidence that every system behaves the same way.\n\nTakeaway: Collective patterns can emerge from local interactions, so understanding the relationships matters as much as understanding the parts.";
    } else if (/feedback/i.test(last)) {
      text =
        "## Understanding feedback loops\n\nA feedback loop occurs when the output of a process influences its future input. Reinforcing feedback amplifies change; balancing feedback counteracts change.\n\nA thermostat is a balancing example: as a room reaches its target temperature, heating reduces. An online trend can show reinforcing feedback: attention brings more attention.\n\nThe effect depends on delays, constraints and the surrounding system. A reinforcing loop cannot grow forever when resources are limited.\n\nTakeaway: Feedback links effects back to their causes, either amplifying or balancing change.";
    } else {
      const question = last.split("\n\n").at(-1) || last;
      text = `## A starting point for your inquiry\n\nYou asked: ${question}\n\nThis is a **synthetic response** for trying Noteboard. It is not a factual answer from a language model. Select a passage such as “connections between ideas” to create your next Note.\n\nAn inquiry develops through connections between ideas: ask a question, inspect an explanation, and choose what deserves further investigation. Each branch keeps its ancestral conversation while excluding unrelated branches.\n\n### Try the interaction\n\nHighlight a concept, edit the suggested question, and follow your curiosity. Switch to Ollama in provider settings when you are ready for real responses.\n\nTakeaway: You direct each branch of the exploration and retain the original path alongside your synthesis.`;
    }
    let result = "";
    for (const part of text.match(/.{1,36}(?:\s|$)|.{1,36}/gs) || []) {
      if (signal.aborted) throw abort();
      await new Promise((r) => setTimeout(r, 8));
      if (signal.aborted) throw abort();
      result += part;
      onDelta(part);
    }
    return { text: result, model: "synthetic-demo" };
  },
};

// Preserve exactly the effective role/content pairs sent to each provider.
export function providerMessages(
  messages: Message[],
  provider: Settings["provider"],
): Message[] {
  return messages.map((message) => ({
    ...message,
    role:
      provider === "chatgpt" && message.role === "system"
        ? "developer"
        : message.role,
  }));
}
