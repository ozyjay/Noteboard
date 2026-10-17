import { useEffect, useRef, useState, type FormEvent } from "react";
import { bridge } from "../../bridge";
import { buildContext } from "../../core/context";
import {
  highlightLabel,
  type Board,
  type Highlight,
  type Note,
  type ReasoningEffort,
  type Settings,
} from "../../core/model";
import { appendNote, completedNote } from "../../core/note-operations";
import { providerMessages, type ModelChoice } from "../../core/providers";
import { type Attachment } from "../../core/research";
import { useChatGPTModels } from "../../model-discovery";
import { errorText } from "../workspace/browser-actions";

import type { Generate } from "../generation/useGeneration";

export function useNoteComposer({
  board,
  settings,
  ready,
  busy,
  generate,
  changeBoard,
  onCreated,
  setError,
}: {
  board: Board | undefined;
  settings: Settings;
  ready: boolean;
  busy: boolean;
  generate: Generate;
  changeBoard: (fn: (board: Board) => Board) => void;
  onCreated: (note: Note) => void;
  setError: (error: string) => void;
}) {
  const [composer, setComposer] = useState<{
      highlight?: Highlight;
      model: string;
      reasoningEffort?: ReasoningEffort;
      webSearch: boolean;
      files: Attachment[];
    } | null>(null),
    [prompt, setPrompt] = useState("");
  const [localComposerModels, setComposerModels] = useState<ModelChoice[]>([]);
  const [localComposerDiscovering, setComposerDiscovering] = useState(false);
  const composerCatalogue = useChatGPTModels(settings, ready && !!composer);
  const composerModels =
    settings.provider === "chatgpt"
      ? composerCatalogue.choices
      : localComposerModels;
  const composerDiscovering =
    settings.provider === "chatgpt"
      ? composerCatalogue.loading
      : localComposerDiscovering;
  useEffect(() => {
    if (composer && composerCatalogue.error) setError(composerCatalogue.error);
  }, [composerCatalogue.error, !!composer]);
  const [composerReading, setComposerReading] = useState(false);
  const composerModelOptions = new Map<string, string>([
    [settings.model, settings.model || "Provider default"],
  ]);
  if (composer)
    composerModelOptions.set(
      composer.model,
      composer.model || "Provider default",
    );
  for (const choice of composerModels)
    composerModelOptions.set(
      typeof choice === "string" ? choice : choice.id,
      typeof choice === "string" ? choice : choice.name,
    );
  const composerSession = useRef(0);
  function openComposer(highlight?: Highlight) {
    composerSession.current += 1;
    setComposerModels([]);
    setComposerDiscovering(false);
    setComposerReading(false);
    setComposer({
      highlight,
      model: settings.model,
      reasoningEffort: settings.reasoningEffort,
      webSearch:
        settings.provider === "chatgpt" && settings.webSearch !== false,
      files: [],
    });
  }
  async function discoverComposerModels() {
    if (!composer) return;
    if (settings.provider === "chatgpt") {
      setError("");
      await composerCatalogue.refresh();
      return;
    }
    const session = composerSession.current;
    setComposerDiscovering(true);
    setError("");
    try {
      const choices = await bridge.models({
        ...settings,
        model: composer.model,
        reasoningEffort: composer.reasoningEffort,
      });
      if (session === composerSession.current) setComposerModels(choices);
    } catch (e) {
      if (session === composerSession.current) setError(errorText(e));
    } finally {
      if (session === composerSession.current) setComposerDiscovering(false);
    }
  }
  async function submitPrompt(event: FormEvent) {
    event.preventDefault();
    if (
      !board ||
      !composer ||
      !prompt.trim() ||
      busy ||
      composerDiscovering ||
      composerReading
    )
      return;
    const snapshot = board;
    const h = composer.highlight;
    const question = prompt.trim();
    const requestSettings = {
      ...settings,
      model: composer.model,
      reasoningEffort: composer.reasoningEffort,
      webSearch: composer.webSearch,
    };
    try {
      const context = providerMessages(
        buildContext(
          snapshot,
          question,
          h,
          settings.customInstructions,
          composer.files,
        ),
        settings.provider,
        composer.webSearch,
      );
      const result = await generate(context, "explore", requestSettings);
      const n = completedNote(
        snapshot,
        question,
        h,
        composer.files,
        settings.provider,
        result,
        context,
      );
      changeBoard((b) => appendNote(b, n, h));
      setComposer(null);
      setPrompt("");
      onCreated(n);
    } catch (e) {
      setError(errorText(e));
    }
  }
  function branch(h: Highlight) {
    setPrompt(`What is ${highlightLabel(h)}?`);
    openComposer(h);
    setError("");
  }

  return {
    composer,
    setComposer,
    prompt,
    setPrompt,
    openComposer,
    branch,
    submitPrompt,
    composerDiscovering,
    composerReading,
    composerModelOptions,
    discoverComposerModels,
    composerModels,
    setComposerReading,
  };
}
