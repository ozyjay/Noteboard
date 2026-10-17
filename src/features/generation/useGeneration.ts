import { useRef, useState } from "react";
import { bridge } from "../../bridge";
import { assertBudget, buildContext } from "../../core/context";
import { uid, type Settings } from "../../core/model";
import { validateRequestFeatures } from "../../core/providers";
import {
  GenerationProgressSchema,
  type GenerationActivity,
} from "../../core/generation-progress";

export interface GenerationPreview {
  activity: GenerationActivity | "sending";
  text: string;
  startedAt: number;
  stopping: boolean;
}

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
  const [progress, setProgress] = useState<GenerationPreview>();
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
    setProgress({
      activity: "sending",
      text: "",
      startedAt: Date.now(),
      stopping: false,
    });
    setError("");
    const unsubscribeDelta = bridge.onDelta((event) => {
      if (
        event.id !== generation.current ||
        cancelled.current ||
        typeof event.text !== "string"
      )
        return;
      setProgress(
        (current) =>
          current && {
            ...current,
            activity: "writing",
            text: current.text + event.text,
          },
      );
    });
    const unsubscribeProgress = bridge.onProgress?.((event) => {
      const parsed = GenerationProgressSchema.safeParse(event);
      if (
        !parsed.success ||
        parsed.data.id !== generation.current ||
        cancelled.current
      )
        return;
      setProgress(
        (current) => current && { ...current, activity: parsed.data.activity },
      );
    });
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
      unsubscribeDelta();
      unsubscribeProgress?.();
      generation.current = undefined;
      setBusy(false);
      setProgress(undefined);
    }
  }

  function cancelGeneration() {
    cancelled.current = true;
    setProgress((current) => current && { ...current, stopping: true });
    if (generation.current) void bridge.cancel(generation.current);
  }
  return { busy, progress, generate, cancelGeneration };
}
