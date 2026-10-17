import { useState, type FormEvent } from "react";
import { buildContext } from "../../core/context";
import { appendDocumentRevision } from "../../core/document-operations";
import {
  now,
  response,
  uid,
  type Artefact,
  type Board,
  type ReasoningEffort,
  type Settings,
} from "../../core/model";
import { providerMessages } from "../../core/providers";
import {
  journey,
  selectMaterial,
  synthesisContext,
} from "../../core/synthesis";
import { errorText } from "../workspace/browser-actions";

import type { Generate } from "../generation/useGeneration";

export function useSynthesis({
  board,
  settings,
  busy,
  selected,
  readerId,
  generate,
  changeBoard,
  setMode,
  setError,
}: {
  board: Board | undefined;
  settings: Settings;
  busy: boolean;
  selected: string[];
  readerId: string | undefined;
  generate: Generate;
  changeBoard: (fn: (board: Board) => Board) => void;
  setMode: (mode: "explore" | "synthesis") => void;
  setError: (error: string) => void;
}) {
  const [synthOpen, setSynthOpen] = useState(false);
  const [scope, setScope] = useState<"board" | "branch" | "selected">("board"),
    [format, setFormat] = useState<Artefact["format"]>("explanation"),
    [structure, setStructure] = useState("Study notes");
  const [activeArtefact, setActiveArtefact] = useState<string>(),
    [documentText, setDocumentText] = useState(""),
    [editing, setEditing] = useState(false),
    [documentDirty, setDocumentDirty] = useState(false);
  const artefact = board?.artefacts.find((a) => a.id === activeArtefact);
  async function consolidate(event: FormEvent) {
    event.preventDefault();
    if (!board || busy) return;
    try {
      const ids = selectMaterial(
        board,
        scope,
        selected.length ? selected : readerId ? [readerId] : [],
      );
      let text: string,
        model: string,
        reasoningEffort: ReasoningEffort | undefined,
        provider: "demo" | "ollama" | "chatgpt" | "human",
        context: ReturnType<typeof buildContext> = [];
      if (format === "journey") {
        text = journey(board, ids);
        model = "verbatim";
        provider = "human";
      } else {
        context = providerMessages(
          synthesisContext(
            board,
            ids,
            format,
            structure,
            settings.customInstructions,
          ),
          settings.provider,
        );
        const result = await generate(context, "synthesis", {
          ...settings,
          webSearch: false,
        });
        text = result.text;
        model = result.model;
        reasoningEffort = result.reasoningEffort;
        provider = settings.provider;
      }
      preserveDraft();
      const a: Artefact = {
        id: uid(),
        title:
          format === "journey"
            ? "Learning journey"
            : format === "explanation"
              ? "Integrated explanation"
              : structure,
        format,
        noteIds: ids,
        sourceVersions: Object.fromEntries(
          ids.map((id) => [
            id,
            response(board.notes.find((n) => n.id === id)!).id,
          ]),
        ),
        versions: [
          {
            id: uid(),
            text,
            createdAt: now(),
            kind: "generated",
            provider,
            model,
            reasoningEffort,
            context,
          },
        ],
      };
      changeBoard((b) => ({ ...b, artefacts: [...b.artefacts, a] }));
      setActiveArtefact(a.id);
      setDocumentText(text);
      setEditing(false);
      setDocumentDirty(false);
      setMode("synthesis");
      setSynthOpen(false);
    } catch (e) {
      setError(errorText(e));
    }
  }
  function saveDocument() {
    if (!artefact || !documentDirty) return;
    changeBoard((b) => appendDocumentRevision(b, artefact.id, documentText));
    setDocumentDirty(false);
  }
  function openDocument(a: Artefact) {
    preserveDraft();
    setActiveArtefact(a.id);
    setDocumentText(a.versions.at(-1)!.text);
    setEditing(false);
    setDocumentDirty(false);
    setMode("synthesis");
  }
  function preserveDraft() {
    if (documentDirty && artefact) saveDocument();
  }

  function withDocumentDraft(board: Board): Board {
    return documentDirty && artefact
      ? appendDocumentRevision(board, artefact.id, documentText)
      : board;
  }
  function resetDocument() {
    setActiveArtefact(undefined);
    setDocumentText("");
    setDocumentDirty(false);
  }
  function openConsolidation() {
    setScope(selected.length ? "selected" : "board");
    setSynthOpen(true);
  }
  return {
    synthOpen,
    setSynthOpen,
    openConsolidation,
    withDocumentDraft,
    resetDocument,
    scope,
    setScope,
    format,
    setFormat,
    structure,
    setStructure,
    activeArtefact,
    setActiveArtefact,
    artefact,
    documentText,
    setDocumentText,
    editing,
    setEditing,
    documentDirty,
    setDocumentDirty,
    consolidate,
    saveDocument,
    openDocument,
    preserveDraft,
  };
}
