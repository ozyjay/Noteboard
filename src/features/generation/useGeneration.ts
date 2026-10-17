import { useRef, useState } from "react";
import { bridge } from "../../bridge";
import { assertBudget, buildContext } from "../../core/context";
import { uid, type Settings } from "../../core/model";
import { validateRequestFeatures } from "../../core/providers";

export type Generate = (
  messages: ReturnType<typeof buildContext>,
  purpose: "explore" | "synthesis",
  requestSettings?: Settings,
) => Promise<Awaited<ReturnType<typeof bridge.generate>>>;

export function useGeneration(
  settings: Settings,
  setError: (error: string) => void,
) {
  const [busy, setBusy] = useState(false);
  const generation = useRef<string | undefined>(undefined),
    cancelled = useRef(false);
  async function generate(
    messages: ReturnType<typeof buildContext>,
    purpose: "explore" | "synthesis",
    requestSettings = settings,
  ) {
    requestSettings = {
      ...requestSettings,
      webSearch:
        requestSettings.provider === "chatgpt" &&
        requestSettings.webSearch === true,
    };
    validateRequestFeatures({
      id: "preflight",
      messages,
      settings: requestSettings,
      purpose,
    });
    assertBudget(messages, requestSettings.contextLimit);
    const id = uid();
    generation.current = id;
    cancelled.current = false;
    setBusy(true);
    setError("");
    try {
      const result = await bridge.generate({
        id,
        messages,
        settings: requestSettings,
        purpose,
      });
      if (cancelled.current)
        throw new Error(
          "Generation cancelled. No Note or document was created.",
        );
      return result;
    } finally {
      generation.current = undefined;
      setBusy(false);
    }
  }

  function cancelGeneration() {
    cancelled.current = true;
    if (generation.current) void bridge.cancel(generation.current);
  }
  return { busy, generate, cancelGeneration };
}
