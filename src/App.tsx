import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  useNodesInitialized,
  MarkerType,
  type NodeChange,
} from "@xyflow/react";
import {
  Plus,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Settings2,
  Layers,
  GitBranch,
  Search,
  BookOpen,
  X,
  Download,
  Upload,
  Check,
  LoaderCircle,
  Square,
  FileText,
  ChevronDown,
  Sparkles,
  Compass,
  Palette,
  Maximize2,
  Minimize2,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
} from "lucide-react";
import { ChatGPTImport } from "./components/ChatGPTImport";
import { annotateContinuation, MAX_EXPORT_BYTES } from "./core/chatgpt-import";
import { edgeLabel } from "./core/model";
import { deleteNote, subtreeIds } from "./core/deletion";
import { AppearanceSettings } from "./components/AppearanceSettings";
import { ChatGPTSettings } from "./components/ChatGPTSettings";
import { providerMessages, type ModelChoice } from "./core/providers";
import { bridge, desktop } from "./bridge";
import {
  type Board,
  type Note,
  type Highlight,
  type Settings,
  type ReasoningEffort,
  type Appearance,
  SettingsSchema,
  type Artefact,
  newBoard,
  uid,
  now,
  response,
  highlightLabel,
  defaults,
  validateBoard,
} from "./core/model";
import {
  ancestry,
  buildContext,
  assertBudget,
  estimateTokens,
  childPosition,
  takeaway,
} from "./core/context";
import { selectMaterial, journey, synthesisContext } from "./core/synthesis";
import { captureHighlight, findHighlightRange } from "./core/selection";
import { exampleBoard } from "./core/example";
import { NoteCard, type CardNode } from "./components/NoteCard";
import {
  HighlightEdge,
  type HighlightFlowEdge,
} from "./components/HighlightEdge";
import { NoteReader } from "./components/NoteReader";
import { NoteRevision, type RevisionMode } from "./components/NoteRevision";
import { appendRevision } from "./core/revisions";
import { pathVersions, versionPath } from "./core/context";
import { versionPrompt, noteAtVersion } from "./core/model";
import { NoteTitle } from "./components/NoteTitle";
import {
  defaultCustomInstructions,
  MAX_CUSTOM_INSTRUCTIONS,
} from "./core/instructions";
import { Markdown } from "./components/Markdown";
const nodeTypes = { note: NoteCard };
const edgeTypes = { highlight: HighlightEdge };
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [boards, setBoards] = useState<Board[]>([]),
    [boardId, setBoardId] = useState(""),
    [settings, setSettings] = useState<Settings>(defaults),
    [ready, setReady] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<{
    boardId: string;
    noteId?: string;
  }>();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [sourcePreview, setSourcePreview] = useState<Note>();
  const [readerVersionId, setReaderVersionId] = useState<string>();
  const [revisionTarget, setRevisionTarget] = useState<{
    noteId: string;
    versionId: string;
    mode: RevisionMode;
  }>();
  const deletedBoards = useRef(new Set<string>());
  const [importSaving, setImportSaving] = useState(false);
  const [continuationTarget, setContinuationTarget] = useState("");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearanceDraft, setAppearanceDraft] = useState<Appearance>(
    defaults.appearance,
  );
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [readerExpanded, setReaderExpanded] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const appearance = appearanceOpen ? appearanceDraft : settings.appearance;
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.dataset.theme =
        appearance.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : appearance.theme;
      root.dataset.accent = appearance.accent;
      root.dataset.noteStyle = appearance.noteStyle;
      root.dataset.textSize = appearance.textSize;
      root.dataset.interfaceFont = appearance.interfaceFont;
      root.dataset.readingFont = appearance.readingFont;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
  const [error, setError] = useState(""),
    [saveStatus, setSaveStatus] = useState("Saved locally"),
    [mode, setMode] = useState<"explore" | "synthesis">("explore");
  const [readerId, setReaderId] = useState<string>(),
    [highlight, setHighlight] = useState<Highlight>(),
    [anchor, setAnchor] = useState<Highlight>(),
    [selected, setSelected] = useState<string[]>([]);
  const [composer, setComposer] = useState<{ highlight?: Highlight } | null>(
      null,
    ),
    [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false),
    [providerOpen, setProviderOpen] = useState(false),
    [synthOpen, setSynthOpen] = useState(false);
  const [scope, setScope] = useState<"board" | "branch" | "selected">("board"),
    [format, setFormat] = useState<Artefact["format"]>("explanation"),
    [structure, setStructure] = useState("Study notes");
  const [activeArtefact, setActiveArtefact] = useState<string>(),
    [documentText, setDocumentText] = useState(""),
    [editing, setEditing] = useState(false),
    [documentDirty, setDocumentDirty] = useState(false);
  const [nodePositions, setNodePositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [nodeDimensions, setNodeDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [search, setSearch] = useState(""),
    [models, setModels] = useState<ModelChoice[]>([]),
    [settingsDraft, setSettingsDraft] = useState<Settings>(defaults),
    [discovering, setDiscovering] = useState(false),
    [accountBusy, setAccountBusy] = useState(false);
  const generation = useRef<string | undefined>(undefined),
    cancelled = useRef(false),
    readerSurface = useRef<HTMLDivElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    saveQueue = useRef(Promise.resolve()),
    loadStarted = useRef(false);
  const currentSettingsDraft = useRef(settingsDraft);
  currentSettingsDraft.current = settingsDraft;
  const { fitView, setCenter, setViewport } = useReactFlow();
  const nodesInitialised = useNodesInitialized();
  const layoutBoard = useRef<string | undefined>(undefined);
  useEffect(() => {
    setContinuationTarget("");
    if (!readerId) setReaderExpanded(false);
  }, [readerId]);
  const board = boards.find((b) => b.id === boardId);
  const note = board?.notes.find((n) => n.id === readerId);
  const version = note
    ? (note.versions.find(
        (v) =>
          v.id ===
          (anchor?.sourceId === note.id ? anchor.versionId : readerVersionId),
      ) ?? response(note))
    : undefined;
  const readingNote =
    note && version ? noteAtVersion(note, version.id) : undefined;
  const artefact = board?.artefacts.find((a) => a.id === activeArtefact);
  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;
    (async () => {
      try {
        const [loaded, s] = await Promise.all([
          bridge.listBoards(),
          bridge.getSettings(),
        ]);
        const initial = loaded.length ? loaded : [exampleBoard()];
        setBoards(initial);
        setBoardId(initial[0].id);
        setSettings(SettingsSchema.parse(s));
        setReady(true);
      } catch (e) {
        setError(`Could not open local data: ${errorText(e)}`);
      }
    })();
  }, []);
  useEffect(() => {
    if (!ready) return;
    setSaveStatus("Saving…");
    const snapshot = boards;
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        for (const b of snapshot)
          if (!deletedBoards.current.has(b.id)) await bridge.saveBoard(b);
        setSaveStatus("Saved locally");
      })
      .catch((e) => {
        setSaveStatus("Save failed");
        setError(
          `Local save failed: ${errorText(e)}. Export the Board to keep a copy.`,
        );
      });
  }, [boards, ready]);
  useEffect(() => {
    if (!board || !nodesInitialised || layoutBoard.current === boardId) return;
    layoutBoard.current = boardId;
    if (board.viewport) void setViewport(board.viewport);
    else void fitView({ padding: 0.22 });
  }, [boardId, ready, nodesInitialised, fitView, setViewport]);
  useEffect(() => {
    setHighlight(undefined);
    if (!anchor || !note || !readerSurface.current) return;
    const root = readerSurface.current;
    let range = findHighlightRange(root, anchor);
    if (!range) {
      const sel = window.getSelection();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode as Text;
        const start = n.data.indexOf(anchor.text);
        if (start >= 0) {
          range = document.createRange();
          range.setStart(n, start);
          range.setEnd(n, start + anchor.text.length);
          break;
        }
      }
      sel?.removeAllRanges();
    }
    if (range) {
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(range);
      range.startContainer.parentElement?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  }, [readerId, anchor, note, version?.id]);
  useEffect(() => {
    if (!highlight || composer || revisionTarget) return;
    const clearDeselectedHighlight = () => {
      const root = readerSurface.current;
      const selection = window.getSelection();
      if (
        !root ||
        !selection ||
        selection.rangeCount !== 1 ||
        selection.isCollapsed ||
        !selection.toString().trim() ||
        !root.contains(selection.anchorNode) ||
        !root.contains(selection.focusNode)
      )
        setHighlight(undefined);
    };
    clearDeselectedHighlight();
    document.addEventListener("selectionchange", clearDeselectedHighlight);
    return () =>
      document.removeEventListener("selectionchange", clearDeselectedHighlight);
  }, [
    Boolean(highlight),
    Boolean(composer),
    Boolean(revisionTarget),
    readerId,
    version?.id,
  ]);
  useEffect(() => {
    if (
      !composer &&
      !providerOpen &&
      !synthOpen &&
      !appearanceOpen &&
      !importOpen &&
      !deleteTarget &&
      !sourcePreview &&
      !revisionTarget &&
      renameDraft === undefined
    )
      return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".modal");
    if (!dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      );
    (
      dialog.querySelector<HTMLElement>("[data-modal-focus]:not(:disabled)") ||
      dialog.querySelector<HTMLElement>("[autofocus]:not(:disabled)") ||
      dialog.querySelector<HTMLElement>("textarea:not(:disabled)") ||
      focusable()[0]
    )?.focus();
    const key = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !busy &&
        !accountBusy &&
        !appearanceSaving &&
        !importSaving &&
        !deleting
      ) {
        setComposer(null);
        setProviderOpen(false);
        setSynthOpen(false);
        setAppearanceOpen(false);
        setImportOpen(false);
        setDeleteTarget(undefined);
        setSourcePreview(undefined);
        setRevisionTarget(undefined);
        setRenameDraft(undefined);
      }
      if (event.key === "Tab") {
        const elements = focusable(),
          first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [
    Boolean(composer),
    providerOpen,
    synthOpen,
    appearanceOpen,
    busy,
    accountBusy,
    appearanceSaving,
    importOpen,
    importSaving,
    Boolean(deleteTarget),
    Boolean(sourcePreview),
    deleting,
    Boolean(revisionTarget),
    renameDraft !== undefined,
  ]);
  function changeBoard(fn: (b: Board) => Board) {
    setBoards((current) =>
      current.map((b) =>
        b.id === boardId ? { ...fn(b), updatedAt: now() } : b,
      ),
    );
  }
  const read = useCallback((id: string, versionId?: string) => {
    setMode("explore");
    setReaderId(id);
    setReaderVersionId(versionId);
    setAnchor(undefined);
    setHighlight(undefined);
  }, []);
  function goSource(id: string) {
    const sourceVersionId =
      mode === "synthesis" ? artefact?.sourceVersions[id] : undefined;
    if (!board?.notes.some((n) => n.id === id)) {
      const sourceArtefact =
        board?.artefacts.find(
          (a) =>
            a.id === activeArtefact &&
            a.archivedSources?.some((n) => n.id === id),
        ) ??
        board?.artefacts.find((a) =>
          a.archivedSources?.some((n) => n.id === id),
        );
      const archived = sourceArtefact?.archivedSources?.find(
        (n) => n.id === id,
      );
      if (archived && sourceArtefact) {
        setSourcePreview(
          noteAtVersion(archived, sourceArtefact.sourceVersions[id]),
        );
        return;
      }
      setError("The source Note is not in this Board");
      return;
    }
    setSourcePreview(undefined);
    read(id, sourceVersionId);
    const n = board.notes.find((n) => n.id === id)!;
    void setCenter(n.position.x + 150, n.position.y + 100, {
      zoom: 1,
      duration: 300,
    });
  }
  function choose(id: string) {
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
  }
  function resetPanels() {
    setReaderId(undefined);
    setReaderVersionId(undefined);
    setRevisionTarget(undefined);
    setHighlight(undefined);
    setAnchor(undefined);
    setSelected([]);
    setMode("explore");
    setActiveArtefact(undefined);
    setDocumentText("");
    setDocumentDirty(false);
  }
  function preserveDraft() {
    if (documentDirty && artefact) saveDocument();
  }
  function createBoard() {
    if (busy) return;
    preserveDraft();
    const b = newBoard();
    setBoards((bs) => [b, ...bs]);
    setBoardId(b.id);
    resetPanels();
    setPrompt("");
    setComposer({});
  }
  async function confirmDeletion() {
    if (
      !board ||
      !deleteTarget ||
      busy ||
      deleting ||
      deleteTarget.boardId !== board.id
    )
      return;
    setDeleteError("");
    if (deleteTarget.noteId) {
      const ids = subtreeIds(board, deleteTarget.noteId);
      preserveDraft();
      changeBoard((b) => deleteNote(b, deleteTarget.noteId!));
      setSelected((current) => current.filter((id) => !ids.has(id)));
      if (readerId && ids.has(readerId)) setReaderId(undefined);
      setAnchor(undefined);
      setHighlight(undefined);
      setContinuationTarget("");
      setDeleteTarget(undefined);
      return;
    }
    setDeleting(true);
    deletedBoards.current.add(board.id);
    try {
      const deletion = saveQueue.current
        .catch(() => {})
        .then(() => bridge.deleteBoard(board.id));
      saveQueue.current = deletion;
      await deletion;
      const remaining = boards.filter((b) => b.id !== board.id);
      if (!remaining.length) remaining.push(newBoard());
      setBoards(remaining);
      setBoardId(remaining[0].id);
      resetPanels();
      setDeleteTarget(undefined);
    } catch (e) {
      deletedBoards.current.delete(board.id);
      setBoards((current) => [...current]);
      setDeleteError(`Could not delete the Board: ${errorText(e)}`);
    } finally {
      setDeleting(false);
    }
  }
  async function generate(
    messages: ReturnType<typeof buildContext>,
    purpose: "explore" | "synthesis",
    requestSettings = settings,
  ) {
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
  async function submitPrompt(event: FormEvent) {
    event.preventDefault();
    if (!board || !composer || !prompt.trim() || busy) return;
    const snapshot = board;
    const h = composer.highlight;
    const question = prompt.trim();
    try {
      const context = providerMessages(
        buildContext(snapshot, question, h, settings.customInstructions),
        settings.provider,
      );
      const result = await generate(context, "explore");
      const parent = h
        ? snapshot.notes.find((n) => n.id === h.sourceId)
        : undefined;
      const n: Note = {
        id: uid(),
        prompt: question,
        takeaway: takeaway(result.text),
        createdAt: now(),
        position: parent ? childPosition(snapshot, parent) : { x: 100, y: 180 },
        versions: [
          {
            id: uid(),
            text: result.text,
            createdAt: now(),
            provider: settings.provider,
            model: result.model,
            reasoningEffort: result.reasoningEffort,
            context,
            origin: "generated",
            estimatedTokens: estimateTokens(context),
            usage: result.usage,
            ancestryVersions: h
              ? pathVersions(snapshot, h.sourceId, h.versionId)
              : {},
          },
        ],
      };
      changeBoard((b) => ({
        ...b,
        title:
          !b.notes.length && b.title === "Untitled inquiry"
            ? question.slice(0, 200)
            : b.title,
        notes: [...b.notes, n],
        edges: h
          ? [
              ...b.edges,
              {
                kind: "highlight",
                id: uid(),
                source: h.sourceId,
                target: n.id,
                highlight: h,
              },
            ]
          : b.edges,
      }));
      setComposer(null);
      setPrompt("");
      setReaderId(n.id);
      setReaderVersionId(undefined);
      setAnchor(undefined);
      setHighlight(undefined);
      void setCenter(n.position.x + 150, n.position.y + 100, {
        zoom: 0.95,
        duration: 350,
      });
    } catch (e) {
      setError(errorText(e));
    }
  }
  function branch(h: Highlight) {
    setPrompt(`What is ${highlightLabel(h)}?`);
    setComposer({ highlight: h });
    setError("");
  }
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
        const result = await generate(context, "synthesis");
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
    changeBoard((b) => ({
      ...b,
      artefacts: b.artefacts.map((a) =>
        a.id === artefact.id
          ? {
              ...a,
              versions: [
                ...a.versions,
                {
                  id: uid(),
                  text: documentText,
                  createdAt: now(),
                  kind: "edited",
                  provider: "human",
                  model: "editor",
                  context: [],
                },
              ],
            }
          : a,
      ),
    }));
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
  async function discover() {
    setDiscovering(true);
    setError("");
    const matchesCurrent = () => {
      const current = currentSettingsDraft.current;
      return (
        current.provider === settingsDraft.provider &&
        current.chatgptAccountId === settingsDraft.chatgptAccountId &&
        current.endpoint === settingsDraft.endpoint
      );
    };
    try {
      const choices = await bridge.models(settingsDraft);
      if (matchesCurrent()) setModels(choices);
    } catch (e) {
      if (matchesCurrent()) setError(errorText(e));
    } finally {
      setDiscovering(false);
    }
  }
  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    try {
      const validated = SettingsSchema.parse(settingsDraft);
      await bridge.saveSettings(validated);
      setSettings(validated);
      setProviderOpen(false);
    } catch (e) {
      setError(errorText(e));
    }
  }
  const nodes: CardNode[] =
    board?.notes.map((n, index) => ({
      id: n.id,
      type: "note",
      position: nodePositions[`${boardId}:${n.id}`] || n.position,
      measured: nodeDimensions[n.id],
      selected: readerId === n.id,
      data: {
        note: n,
        index,
        children: board.edges.filter((e) => e.source === n.id).length,
        chosen: selected.includes(n.id),
        onRead: read,
        onChoose: choose,
      },
    })) || [];
  const trackDimensions = useCallback(
    (changes: NodeChange<CardNode>[]) => {
      const movements = changes.filter(
        (change) => change.type === "position" && change.position,
      );
      if (movements.length)
        setNodePositions((current) => {
          const next = { ...current };
          for (const change of movements)
            if (change.type === "position" && change.position)
              next[`${boardId}:${change.id}`] = change.position;
          return next;
        });
      const settled = movements.filter(
        (change) => change.type === "position" && !change.dragging,
      );
      if (settled.length)
        changeBoard((b) => ({
          ...b,
          notes: b.notes.map((n) => {
            const change = settled.find(
              (change) => change.type === "position" && change.id === n.id,
            );
            return change?.type === "position" && change.position
              ? { ...n, position: change.position }
              : n;
          }),
        }));
      const updates = changes.filter(
        (change) => change.type === "dimensions" && change.dimensions,
      );
      if (!updates.length) return;
      setNodeDimensions((current) => {
        let next = current;
        for (const change of updates) {
          if (change.type !== "dimensions" || !change.dimensions) continue;
          const previous = current[change.id];
          if (
            previous?.width !== change.dimensions.width ||
            previous?.height !== change.dimensions.height
          ) {
            if (next === current) next = { ...current };
            next[change.id] = change.dimensions;
          }
        }
        return next;
      });
    },
    [boardId],
  );
  function openEdgeSource(id: string) {
    const e = board!.edges.find((edge) => edge.id === id)!;
    read(
      e.source,
      e.highlight?.versionId ??
        board!.notes.find((n) => n.id === e.source)!.versions[0].id,
    );
    setAnchor(e.highlight);
    setHighlight(undefined);
  }
  const edges: HighlightFlowEdge[] =
    board?.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: { text: edgeLabel(e), onOpenSource: () => openEdgeSource(e.id) },
      type: "highlight",
      focusable: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge)" },
      style: {
        stroke: "var(--edge)",
        strokeWidth: 1.5,
        ...(e.kind === "continuation" ? { strokeDasharray: "6 4" } : {}),
      },
    })) || [];
  const incoming = board?.edges.find((e) => e.target === readerId);
  function readParent() {
    if (!board || !note || !version || !incoming) return;
    const parent = versionPath(board, note.id, version.id).at(-2)!;
    read(parent.note.id, parent.version.id);
    if (incoming.highlight?.versionId === parent.version.id)
      setAnchor(incoming.highlight);
  }
  if (!ready)
    return (
      <main className="loading">
        <Compass size={36} />
        <p>{error || "Opening your workspace…"}</p>
      </main>
    );
  return (
    <div className="app-shell">
      <aside
        id="workspace-sidebar"
        className="sidebar"
        aria-label="Workspace sidebar"
        hidden={!sidebarVisible}
      >
        <div className="brand">
          <span className="brand-icon">
            <Compass size={24} />
          </span>
          <span>
            Noteboard<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="workspace-label">
          YOUR WORKSPACE <span>LOCAL</span>
        </div>
        <button className="new-board" onClick={createBoard} disabled={busy}>
          <Plus size={16} /> New inquiry
        </button>
        <div className="sidebar-section">
          <span>BOARDS</span>
          <span>{boards.length}</span>
        </div>
        <nav className="boards">
          {boards
            .filter((b) => b.title.toLowerCase().includes(search.toLowerCase()))
            .map((b) => (
              <button
                key={b.id}
                disabled={busy}
                className={b.id === boardId ? "active" : ""}
                onClick={() => {
                  preserveDraft();
                  setBoardId(b.id);
                  resetPanels();
                }}
              >
                <Layers size={16} />
                <span>
                  {b.title}
                  <small>{b.notes.length} Notes</small>
                </span>
              </button>
            ))}
        </nav>
        <label className="board-search">
          <Search size={14} />
          <input
            placeholder="Find a Board"
            aria-label="Find a Board"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="sidebar-spacer" />
        <div className="sidebar-section">
          <span>YOUR ARTEFACTS</span>
          <FileText size={13} />
        </div>
        <div className="artefact-list">
          {board?.artefacts.length ? (
            board.artefacts.map((a) => (
              <button
                key={a.id}
                disabled={busy}
                onClick={() => openDocument(a)}
              >
                <FileText size={15} />
                {a.title}
              </button>
            ))
          ) : (
            <p>
              Your exploration, brought together.
              <br />
              Consolidate Notes to create a document.
            </p>
          )}
        </div>
        <div className="provider-card">
          <span className="status-dot" />
          <div>
            <strong>
              {settings.provider === "demo"
                ? "Demo workspace"
                : settings.provider === "chatgpt"
                  ? "ChatGPT plan"
                  : "Ollama · local"}
            </strong>
            <small>
              {settings.provider === "demo"
                ? "Synthetic example responses"
                : settings.model || "Choose a model"}
            </small>
          </div>
          <button
            aria-label="Provider settings"
            disabled={busy}
            onClick={() => {
              setSettingsDraft(settings);
              setModels([]);
              setError("");
              setProviderOpen(true);
            }}
          >
            <Settings2 size={16} />
          </button>
        </div>
        <div className="local-status">
          <Check size={12} />
          {saveStatus}
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="sidebar-toggle"
              aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
              title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
              aria-expanded={sidebarVisible}
              aria-controls="workspace-sidebar"
              onClick={() => setSidebarVisible((visible) => !visible)}
            >
              {sidebarVisible ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )}
            </button>
            <div className="breadcrumb">
              Workspace <span>/</span>
              <strong>{board?.title}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              aria-label="Delete Board"
              title="Delete Board"
              disabled={busy || !board}
              onClick={() => {
                setDeleteError("");
                setDeleteTarget({ boardId });
              }}
            >
              <Trash2 size={16} />
            </button>
            <button
              aria-label="Appearance settings"
              title="Appearance settings"
              onClick={() => {
                setAppearanceDraft(settings.appearance);
                setError("");
                setAppearanceOpen(true);
              }}
            >
              <Palette size={16} />
            </button>
            <button
              title="Import a Board"
              aria-label="Import a Board"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={16} />
            </button>
            <button
              aria-label="Import ChatGPT conversation"
              title="Import ChatGPT conversation"
              disabled={busy || importSaving}
              onClick={() => {
                setImportOpen(true);
                setError("");
              }}
            >
              <Upload size={16} /> ChatGPT
            </button>
            <button
              title="Export Board"
              aria-label="Export Board"
              onClick={() => {
                if (board) {
                  preserveDraft();
                  const exported =
                    documentDirty && artefact
                      ? {
                          ...board,
                          artefacts: board.artefacts.map((a) =>
                            a.id === artefact.id
                              ? {
                                  ...a,
                                  versions: [
                                    ...a.versions,
                                    {
                                      id: uid(),
                                      text: documentText,
                                      createdAt: now(),
                                      kind: "edited" as const,
                                      provider: "human" as const,
                                      model: "editor",
                                      context: [],
                                    },
                                  ],
                                }
                              : a,
                          ),
                        }
                      : board;
                  download(
                    "noteboard-board.json",
                    JSON.stringify(exported, null, 2),
                    "application/json",
                  );
                }
              }}
            >
              <Download size={16} />
            </button>
            <span className="avatar">Y</span>
          </div>
        </header>
        <div className="board-heading">
          <div>
            <div className="eyebrow">FOLLOW YOUR CURIOSITY</div>
            <div className="board-title-row">
              <h1>{board?.title}</h1>
              <button
                className="rename-board"
                aria-label="Rename Board"
                title="Rename Board"
                disabled={busy || !board}
                onClick={() => setRenameDraft(board?.title)}
              >
                <Pencil size={16} />
              </button>
            </div>
            <p>Every good question opens another door.</p>
          </div>
          <button
            className="primary"
            disabled={busy || !board?.notes.length}
            onClick={() => {
              setScope(selected.length ? "selected" : "board");
              setSynthOpen(true);
            }}
          >
            <Sparkles size={15} /> Consolidate <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="modebar">
          <div className="mode-tabs">
            <button
              className={mode === "explore" ? "active" : ""}
              onClick={() => {
                preserveDraft();
                setMode("explore");
              }}
            >
              <GitBranch size={15} /> Explore
            </button>
            <button
              className={mode === "synthesis" ? "active" : ""}
              onClick={() => setMode("synthesis")}
            >
              <BookOpen size={15} /> Synthesis{" "}
              {board?.artefacts.length ? (
                <span>{board.artefacts.length}</span>
              ) : null}
            </button>
          </div>
          <div className="board-info">
            {selected.length ? `${selected.length} selected · ` : ""}
            {board?.notes.length} Notes <span>·</span> {board?.edges.length}{" "}
            connections
          </div>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={14} />
            </button>
          </div>
        )}
        {!desktop && (
          <div className="preview-banner">
            Browser preview · demo responses and browser storage. Use the
            desktop app for SQLite and Ollama.
          </div>
        )}
        {mode === "explore" ? (
          <div className="exploration">
            <div className="canvas" inert={readerExpanded || undefined}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={trackDimensions}
                minZoom={0.2}
                maxZoom={1.5}
                nodesConnectable={false}
                deleteKeyCode={null}
                onNodeDoubleClick={(_, n) => read(n.id)}
                onNodeDragStop={(_, n) =>
                  changeBoard((b) => ({
                    ...b,
                    notes: b.notes.map((note) =>
                      note.id === n.id
                        ? { ...note, position: n.position }
                        : note,
                    ),
                  }))
                }
                edgeTypes={edgeTypes}
                onEdgeClick={(_, edge) => openEdgeSource(edge.id)}
                onMoveEnd={(_, viewport) =>
                  changeBoard((b) => ({ ...b, viewport }))
                }
              >
                {appearance.showGrid && (
                  <Background color="var(--grid)" gap={24} size={1} />
                )}
                <Controls showInteractive={false} />
                <MiniMap
                  style={{ width: 135, height: 90 }}
                  nodeColor={(n) =>
                    [
                      "var(--note-0)",
                      "var(--note-1)",
                      "var(--note-2)",
                      "var(--note-3)",
                    ][(n.data as CardNode["data"]).index % 4]
                  }
                  maskColor="var(--minimap-mask)"
                  pannable
                  zoomable
                />
              </ReactFlow>
              {!board?.notes.length && (
                <div className="empty-board">
                  <span>
                    <Compass size={34} />
                  </span>
                  <h2>Where will your curiosity take you?</h2>
                  <p>
                    Start with a question. Follow the ideas that interest you.
                  </p>
                  <button
                    className="primary"
                    onClick={() => {
                      setPrompt("");
                      setComposer({});
                    }}
                  >
                    <Plus size={16} /> Ask your first question
                  </button>
                </div>
              )}
              <div className="canvas-guide">
                <span className="guide-dot" />{" "}
                {board?.notes.length
                  ? "Open a Note. Highlight a passage. Follow a new branch."
                  : "Your inquiry starts with you."}
              </div>
            </div>
            {note && (
              <NoteReader
                expanded={readerExpanded}
                className={`reader colour-${board!.notes.findIndex((n) => n.id === note.id) % 4} ${readerExpanded ? "reader-expanded" : ""}`}
              >
                <div className="panel-head">
                  <span>
                    <BookOpen size={15} /> NOTE{" "}
                    {String(board!.notes.indexOf(note) + 1).padStart(2, "0")}
                  </span>
                  <button
                    aria-label="Delete Note"
                    title="Delete Note"
                    disabled={busy}
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget({ boardId, noteId: note.id });
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                  <button
                    aria-label={
                      readerExpanded ? "Collapse Note" : "Expand Note"
                    }
                    title={
                      readerExpanded ? "Return to side panel" : "Fill workspace"
                    }
                    aria-pressed={readerExpanded}
                    onClick={() => setReaderExpanded((value) => !value)}
                  >
                    {readerExpanded ? (
                      <Minimize2 size={18} />
                    ) : (
                      <Maximize2 size={18} />
                    )}
                  </button>
                  <button
                    aria-label="Close Note"
                    onClick={() => {
                      setReaderId(undefined);
                      setAnchor(undefined);
                      setHighlight(undefined);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="reader-scroll">
                  {incoming && (
                    <button className="parent-link" onClick={readParent}>
                      <ArrowLeft size={13} /> From “
                      {edgeLabel(incoming).slice(0, 60)}”
                    </button>
                  )}
                  <NoteTitle
                    key={`title-${note.id}-${version!.id}`}
                    note={readingNote!}
                    busy={busy}
                    onEditPrompt={() =>
                      setRevisionTarget({
                        noteId: note.id,
                        versionId: version!.id,
                        mode: "prompt",
                      })
                    }
                    onSave={(title) =>
                      changeBoard((b) => ({
                        ...b,
                        notes: b.notes.map((n) =>
                          n.id === note.id ? { ...n, title } : n,
                        ),
                      }))
                    }
                  />
                  <div className="note-revisions">
                    <label>
                      Version
                      <select
                        aria-label="Note version"
                        value={version!.id}
                        disabled={busy}
                        onChange={(e) => {
                          setReaderVersionId(e.target.value);
                          setAnchor(undefined);
                          setHighlight(undefined);
                          window.getSelection()?.removeAllRanges();
                        }}
                      >
                        {note.versions.map((v, i) => (
                          <option key={v.id} value={v.id}>
                            v{i + 1} ·{" "}
                            {v.origin === "edited"
                              ? "Human-edited"
                              : v.origin === "imported"
                                ? "Imported"
                                : v.provider === "demo"
                                  ? "Synthetic demo"
                                  : v.model}
                            {i === note.versions.length - 1 ? " · Latest" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="revision-actions">
                      {(
                        [
                          ["prompt", "Edit prompt and regenerate"],
                          ["regenerate", "Regenerate response"],
                          ["edit", "Edit response"],
                        ] as const
                      ).map(([mode, label]) => (
                        <button
                          key={mode}
                          disabled={busy}
                          onClick={() =>
                            setRevisionTarget({
                              noteId: note.id,
                              versionId: version!.id,
                              mode,
                            })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {version!.id !== response(note).id && (
                      <p className="muted small">
                        Viewing an earlier version. New branches use this
                        version; the canvas and new synthesis use the latest
                        version.
                      </p>
                    )}
                  </div>
                  <nav className="note-navigation" aria-label="Connected notes">
                    <strong>Previous note</strong>
                    {incoming ? (
                      <button onClick={readParent}>
                        <ArrowLeft size={14} />
                        {board!.notes.find((n) => n.id === incoming.source)!
                          .title ??
                          board!.notes.find((n) => n.id === incoming.source)!
                            .prompt}
                      </button>
                    ) : (
                      <p className="muted">This is the starting note.</p>
                    )}
                    <strong>Subsequent notes</strong>
                    {board!.edges.some((e) => e.source === note.id) ? (
                      board!.edges
                        .filter((e) => e.source === note.id)
                        .map((e) => {
                          const child = board!.notes.find(
                            (n) => n.id === e.target,
                          )!;
                          return (
                            <button key={e.id} onClick={() => read(child.id)}>
                              <ArrowRight size={14} />
                              {child.title ?? child.prompt}
                            </button>
                          );
                        })
                    ) : (
                      <p className="muted">No subsequent notes yet.</p>
                    )}
                  </nav>
                  {response(readingNote!).origin === "imported" && (
                    <p className="muted">
                      Imported from ChatGPT · Model:{" "}
                      {response(readingNote!).model ?? "Unknown"}. Original
                      generation context, token estimates and usage are unknown.
                    </p>
                  )}
                  <div className="note-meta">
                    <span>
                      {version?.origin === "edited"
                        ? "HUMAN-EDITED"
                        : response(readingNote!).provider === "demo"
                          ? "SYNTHETIC DEMO"
                          : (response(readingNote!).model ?? "Unknown")}
                      {version?.origin === "generated" &&
                      version.reasoningEffort
                        ? ` · ${version.reasoningEffort} thinking`
                        : ""}
                    </span>
                    <span>
                      v
                      {note.versions.findIndex((v) => v.id === version!.id) + 1}{" "}
                      of {note.versions.length} ·{" "}
                      {ancestry(board!, note.id).length - 1} steps from root
                    </span>
                  </div>
                  <div
                    className="reader-response prose editable-note-text"
                    role="region"
                    aria-label="Response — click or press Enter to edit"
                    aria-keyshortcuts="Enter"
                    tabIndex={busy ? -1 : 0}
                    title="Click to edit response. Select text to explore a passage."
                    onClick={(event) => {
                      if (
                        busy ||
                        window.getSelection()?.isCollapsed === false ||
                        (event.target as HTMLElement).closest(
                          "button, a, input, textarea, select",
                        )
                      )
                        return;
                      setRevisionTarget({
                        noteId: note.id,
                        versionId: version!.id,
                        mode: "edit",
                      });
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        event.target === event.currentTarget &&
                        !busy
                      ) {
                        event.preventDefault();
                        setRevisionTarget({
                          noteId: note.id,
                          versionId: version!.id,
                          mode: "edit",
                        });
                      }
                    }}
                    data-maths={
                      !(anchor?.surface === "rendered" && !anchor.renderedMath)
                    }
                    ref={readerSurface}
                    onMouseUp={() => {
                      const h = captureHighlight(
                        readerSurface.current!,
                        readingNote!,
                        window.getSelection(),
                      );
                      setHighlight(h);
                    }}
                    onKeyUp={() =>
                      setHighlight(
                        captureHighlight(
                          readerSurface.current!,
                          readingNote!,
                          window.getSelection(),
                        ),
                      )
                    }
                  >
                    <Markdown
                      text={response(readingNote!).text}
                      onSource={goSource}
                      maths={
                        !(
                          anchor?.surface === "rendered" && !anchor.renderedMath
                        )
                      }
                    />
                  </div>
                  {anchor && (
                    <div className="anchor-info">
                      Source Highlight: “{highlightLabel(anchor)}”
                    </div>
                  )}
                  <details className="takeaway-controls" key={note.id}>
                    <summary>Edit takeaway</summary>
                    <label className="takeaway-editor">
                      TAKEAWAY{" "}
                      <textarea
                        aria-label="Edit Takeaway"
                        value={note.takeaway}
                        onChange={(e) =>
                          changeBoard((b) => ({
                            ...b,
                            notes: b.notes.map((n) =>
                              n.id === note.id
                                ? { ...n, takeaway: e.target.value }
                                : n,
                            ),
                          }))
                        }
                      />
                    </label>
                  </details>
                  {board!.edges.filter((e) => e.source === note.id).length >
                    0 && (
                    <div className="existing-branches">
                      <h3>EXPLORED FROM THIS NOTE</h3>
                      {board!.edges
                        .filter((e) => e.source === note.id)
                        .map((e) => (
                          <div key={e.id}>
                            <button onClick={() => setAnchor(e.highlight)}>
                              “{edgeLabel(e)}”
                            </button>
                            {e.kind === "continuation" && e.highlight && (
                              <button
                                disabled={busy}
                                aria-label={`Remove retrospective Highlight for ${board!.notes.find((n) => n.id === e.target)!.prompt}`}
                                onClick={() => {
                                  changeBoard((b) =>
                                    annotateContinuation(b, e.id),
                                  );
                                  setAnchor(undefined);
                                  setHighlight(undefined);
                                }}
                              >
                                Remove Highlight
                              </button>
                            )}
                            <button
                              aria-label={`Open branch ${edgeLabel(e)}`}
                              onClick={() => read(e.target)}
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                  <details className="context-details">
                    <summary>
                      {version?.origin === "edited"
                        ? "Human-edited revision · "
                        : version?.origin === "imported"
                          ? "Import record · "
                          : "Generation record · ~"}
                      {response(
                        readingNote!,
                      ).estimatedTokens?.toLocaleString() ?? "Unknown"}{" "}
                      context tokens
                    </summary>
                    <p>
                      {new Date(
                        response(readingNote!).createdAt,
                      ).toLocaleString("en-AU")}
                      {version?.origin === "generated" &&
                        version.usage &&
                        ` · ${version.usage.input || 0} input / ${version.usage.output || 0} output tokens`}
                      {version?.origin === "imported" && (
                        <span>
                          {" "}
                          · Imported{" "}
                          {new Date(
                            version.provenance.importedAt,
                          ).toLocaleString("en-AU")}{" "}
                          · Conversation {version.provenance.conversationId} ·
                          Question {version.provenance.promptMessageId} · Answer{" "}
                          {version.provenance.responseMessageId} · Original
                          question date:{" "}
                          {version.provenance.promptCreatedAt || "Unknown"} ·
                          Original answer date:{" "}
                          {version.provenance.responseCreatedAt || "Unknown"}
                        </span>
                      )}
                      {version &&
                        "basedOnVersionId" in version &&
                        version.basedOnVersionId && (
                          <span>
                            {" "}
                            · Based on v
                            {note.versions.findIndex(
                              (v) => v.id === version.basedOnVersionId,
                            ) + 1}
                            {version.origin === "edited"
                              ? " · Human edit; no inference request"
                              : ""}
                          </span>
                        )}
                    </p>
                    {(response(readingNote!).context ?? []).map((m, i) => (
                      <div key={i}>
                        <strong>{m.role}</strong>
                        <pre>{m.content}</pre>
                      </div>
                    ))}
                  </details>
                </div>
                <div className="reader-footer">
                  {highlight ? (
                    <>
                      <p>
                        “
                        {highlightLabel(highlight).length > 90
                          ? highlightLabel(highlight).slice(0, 87) + "…"
                          : highlightLabel(highlight)}
                        ”
                      </p>
                      {version?.origin === "imported" &&
                        board!.edges.some(
                          (e) =>
                            e.kind === "continuation" && e.source === note.id,
                        ) && (
                          <>
                            <label>
                              Imported follow-up
                              <select
                                aria-label="Imported follow-up"
                                value={continuationTarget}
                                onChange={(e) =>
                                  setContinuationTarget(e.target.value)
                                }
                              >
                                <option value="">Choose follow-up</option>
                                {board!.edges
                                  .filter(
                                    (e) =>
                                      e.kind === "continuation" &&
                                      e.source === note.id,
                                  )
                                  .map((e) => (
                                    <option key={e.id} value={e.id}>
                                      {
                                        board!.notes.find(
                                          (n) => n.id === e.target,
                                        )!.prompt
                                      }
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button
                              disabled={
                                busy ||
                                (board!.edges.filter(
                                  (e) =>
                                    e.kind === "continuation" &&
                                    e.source === note.id,
                                ).length > 1 &&
                                  !board!.edges.some(
                                    (e) =>
                                      e.id === continuationTarget &&
                                      e.source === note.id,
                                  ))
                              }
                              onClick={() => {
                                const candidates = board!.edges.filter(
                                  (e) =>
                                    e.kind === "continuation" &&
                                    e.source === note.id,
                                );
                                const target =
                                  candidates.length === 1
                                    ? candidates[0]
                                    : candidates.find(
                                        (e) => e.id === continuationTarget,
                                      );
                                if (target) {
                                  changeBoard((b) =>
                                    annotateContinuation(
                                      b,
                                      target.id,
                                      highlight,
                                    ),
                                  );
                                  setAnchor(highlight);
                                  setHighlight(undefined);
                                }
                              }}
                            >
                              Attach Highlight to imported follow-up
                            </button>
                          </>
                        )}
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => branch(highlight)}
                      >
                        <GitBranch size={15} /> Explore this passage{" "}
                        <ArrowUpRight size={15} />
                      </button>
                    </>
                  ) : (
                    <p>
                      Select a passage in the response to begin a new branch.
                    </p>
                  )}
                </div>
              </NoteReader>
            )}
          </div>
        ) : (
          <section className="synthesis-workspace">
            {artefact ? (
              <>
                <div className="document-toolbar">
                  <div>
                    <span className="eyebrow">
                      {artefact.noteIds.length} SOURCE NOTES
                    </span>
                    <h2>{artefact.title}</h2>
                  </div>
                  <div>
                    <select
                      aria-label="Document version"
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        preserveDraft();
                        setDocumentText(
                          artefact.versions.find(
                            (v) => v.id === e.target.value,
                          )!.text,
                        );
                        setDocumentDirty(true);
                      }}
                    >
                      <option value="">
                        History · {artefact.versions.length} versions
                      </option>
                      {artefact.versions.map((v, i) => (
                        <option key={v.id} value={v.id}>
                          v{i + 1} · {v.kind} ·{" "}
                          {new Date(v.createdAt).toLocaleString("en-AU")}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => setEditing((v) => !v)}>
                      {editing ? "Preview" : "Edit"}
                    </button>
                    <button
                      onClick={() =>
                        download(
                          "noteboard-synthesis.md",
                          documentText,
                          "text/markdown",
                        )
                      }
                      aria-label="Export synthesis"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      className="primary"
                      disabled={!documentDirty}
                      onClick={saveDocument}
                    >
                      Save revision
                    </button>
                  </div>
                </div>
                {editing ? (
                  <textarea
                    className="document-editor"
                    aria-label="Synthesis document"
                    value={documentText}
                    onChange={(e) => {
                      setDocumentText(e.target.value);
                      setDocumentDirty(true);
                    }}
                  />
                ) : (
                  <div className="document-preview prose">
                    <Markdown
                      text={documentText}
                      onSource={(id) => {
                        preserveDraft();
                        goSource(id);
                      }}
                    />
                  </div>
                )}
                <div className="document-sources">
                  <span>Source Notes</span>
                  {artefact.noteIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        preserveDraft();
                        goSource(id);
                      }}
                    >
                      {(() => {
                        const source =
                          board!.notes.find((n) => n.id === id) ??
                          artefact.archivedSources?.find((n) => n.id === id);
                        return source
                          ? versionPrompt(
                              source,
                              source.versions.find(
                                (v) => v.id === artefact.sourceVersions[id],
                              )!,
                            )
                          : "Source Note";
                      })()}
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="synthesis-empty">
                <BookOpen size={36} />
                <h2>Bring your exploration together.</h2>
                <p>
                  Create a learning journey, an integrated explanation, or a
                  structured artefact.
                  <br />
                  Your original Board stays connected and intact.
                </p>
                <button
                  className="primary"
                  disabled={!board?.notes.length}
                  onClick={() => setSynthOpen(true)}
                >
                  Consolidate Notes <ArrowUpRight size={15} />
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      <input
        type="file"
        accept="application/json,.json"
        hidden
        ref={fileInput}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > MAX_EXPORT_BYTES)
              throw new Error("Board files must be at most 50 MiB");
            const b = validateBoard(JSON.parse(await file.text()));
            preserveDraft();
            const imported = {
              ...b,
              id: uid(),
              title: `${b.title.slice(0, 189)} (imported)`,
              updatedAt: now(),
            };
            setBoards((bs) => [imported, ...bs]);
            setBoardId(imported.id);
            resetPanels();
          } catch (err) {
            setError(`Import failed: ${errorText(err)}`);
          }
          e.target.value = "";
        }}
      />
      {importOpen && (
        <ChatGPTImport
          onClose={() => setImportOpen(false)}
          onSaving={setImportSaving}
          onImport={async (imported) => {
            await saveQueue.current.catch(() => {});
            await bridge.saveBoard(imported);
            preserveDraft();
            setBoards((bs) => [imported, ...bs]);
            setBoardId(imported.id);
            resetPanels();
            setImportOpen(false);
          }}
        />
      )}
      {revisionTarget && board && (
        <NoteRevision
          key={`${revisionTarget.noteId}:${revisionTarget.versionId}:${revisionTarget.mode}`}
          board={board}
          note={board.notes.find((n) => n.id === revisionTarget.noteId)!}
          versionId={revisionTarget.versionId}
          mode={revisionTarget.mode}
          settings={settings}
          busy={busy}
          onGenerate={(messages, requestSettings) =>
            generate(messages, "explore", requestSettings)
          }
          onSave={(newVersion) => {
            // Validate before closing the draft; errors leave it available for retry.
            appendRevision(board, revisionTarget.noteId, newVersion);
            changeBoard((b) =>
              appendRevision(b, revisionTarget.noteId, newVersion),
            );
            setReaderVersionId(newVersion.id);
            setAnchor(undefined);
            setHighlight(undefined);
            setError("");
            setRevisionTarget(undefined);
          }}
          onClose={() => setRevisionTarget(undefined)}
          onCancel={() => {
            cancelled.current = true;
            if (generation.current) void bridge.cancel(generation.current);
          }}
        />
      )}
      {composer && (
        <div className="modal-backdrop">
          <section
            className="modal composer"
            role="dialog"
            aria-modal="true"
            aria-label={
              composer.highlight ? "Explore a passage" : "Start an inquiry"
            }
          >
            <div className="panel-head">
              <span>
                <GitBranch size={16} />
                {composer.highlight
                  ? "FOLLOW A NEW THREAD"
                  : "START AN INQUIRY"}
              </span>
              <button
                aria-label="Close composer"
                disabled={busy}
                onClick={() => {
                  setComposer(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <h2>
              {composer.highlight
                ? "What would you like to explore?"
                : "Begin with a question."}
            </h2>
            {composer.highlight && (
              <blockquote>{highlightLabel(composer.highlight)}</blockquote>
            )}
            <form onSubmit={submitPrompt}>
              <label>
                Your question
                <textarea
                  autoFocus
                  required
                  maxLength={30000}
                  value={prompt}
                  disabled={busy}
                  onChange={(e) => setPrompt(e.target.value)}
                  aria-describedby="prompt-keyboard-hint"
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing &&
                      e.nativeEvent.keyCode !== 229
                    ) {
                      e.preventDefault();
                      if (!e.repeat && !busy && prompt.trim())
                        e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="What are you curious about?"
                />
              </label>
              <p id="prompt-keyboard-hint" className="muted keyboard-hint">
                Enter to send · Shift+Enter for a new line
              </p>
              {composer.highlight &&
                board &&
                ancestry(board, composer.highlight.sourceId).length >=
                  settings.depthReminder && (
                  <p className="reminder">
                    This branch will reach{" "}
                    {ancestry(board, composer.highlight.sourceId).length} steps.
                    Consider consolidating when you are ready; you can continue
                    exploring.
                  </p>
                )}
              <div className="composer-meta">
                <span>
                  {settings.provider === "demo"
                    ? "Synthetic demo"
                    : settings.model}{" "}
                  {settings.provider === "chatgpt" && settings.reasoningEffort
                    ? `· ${settings.reasoningEffort} thinking `
                    : ""}
                  · ~
                  {board
                    ? estimateTokens(
                        buildContext(
                          board,
                          prompt,
                          composer.highlight,
                          settings.customInstructions,
                        ),
                      ).toLocaleString()
                    : 0}{" "}
                  context tokens
                </span>
                {settings.provider === "chatgpt" ? (
                  <span>
                    Using ChatGPT plan ·{" "}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        void bridge
                          .chatgptUsage()
                          .catch((e) => setError(errorText(e)))
                      }
                    >
                      Manage usage
                    </button>
                  </span>
                ) : (
                  <span>History stays complete</span>
                )}
              </div>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {busy && (
                <div className="generation-progress" role="status">
                  <LoaderCircle className="spin" size={18} aria-hidden="true" />
                  Generating your response…
                </div>
              )}
              <div className="modal-actions">
                {busy ? (
                  <button
                    type="button"
                    className="secondary"
                    data-modal-focus
                    onClick={() => {
                      cancelled.current = true;
                      if (generation.current)
                        void bridge.cancel(generation.current);
                    }}
                  >
                    <Square size={13} /> Cancel generation
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setComposer(null)}
                  >
                    Cancel
                  </button>
                )}
                <button className="primary" disabled={busy || !prompt.trim()}>
                  {busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}{" "}
                  {busy
                    ? "Exploring…"
                    : composer.highlight
                      ? "Create branch"
                      : "Ask & explore"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {appearanceOpen && (
        <AppearanceSettings
          value={appearanceDraft}
          onChange={setAppearanceDraft}
          saving={appearanceSaving}
          error={error}
          onClose={() => setAppearanceOpen(false)}
          onSave={async () => {
            setAppearanceSaving(true);
            setError("");
            try {
              const next = { ...settings, appearance: appearanceDraft };
              await bridge.saveSettings(next);
              setSettings(next);
              setAppearanceOpen(false);
            } catch (e) {
              setError(errorText(e));
            } finally {
              setAppearanceSaving(false);
            }
          }}
        />
      )}
      {providerOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Provider settings"
          >
            <div className="panel-head">
              <span>
                <Settings2 size={16} /> PROVIDER SETTINGS
              </span>
              <button
                aria-label="Close provider settings"
                disabled={accountBusy}
                onClick={() => setProviderOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <h2>Your model. Your inquiry.</h2>
            <p className="muted">
              Choose the connection used for your next Note. Existing Notes keep
              their original model and context.
            </p>
            <form onSubmit={saveSettings}>
              <label>
                Provider
                <select
                  aria-label="Provider"
                  value={settingsDraft.provider}
                  disabled={accountBusy}
                  onChange={(e) => {
                    setModels([]);
                    setError("");
                    setSettingsDraft((s) => ({
                      ...s,
                      model: "",
                      reasoningEffort: undefined,
                      provider: e.target.value as Settings["provider"],
                    }));
                  }}
                >
                  <option value="demo">Demo — synthetic responses</option>
                  <option value="chatgpt" disabled={!desktop}>
                    ChatGPT — use your plan
                  </option>
                  <option value="ollama" disabled={!desktop}>
                    Ollama — local inference
                  </option>
                </select>
              </label>
              {settingsDraft.provider === "chatgpt" && (
                <ChatGPTSettings
                  accountId={settingsDraft.chatgptAccountId}
                  onAccount={(id) => {
                    setModels([]);
                    setSettingsDraft((s) => ({
                      ...s,
                      chatgptAccountId: id,
                      model: "",
                      reasoningEffort: undefined,
                    }));
                  }}
                  onError={setError}
                  onBusy={setAccountBusy}
                />
              )}
              {settingsDraft.provider === "ollama" && (
                <>
                  <label>
                    Local server address
                    <input
                      value={settingsDraft.endpoint}
                      required
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          endpoint: e.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              )}
              {settingsDraft.provider !== "demo" && (
                <>
                  <label>
                    Model
                    <div className="model-input">
                      {settingsDraft.provider === "chatgpt" ? (
                        <select
                          required
                          aria-label="Model"
                          value={settingsDraft.model}
                          disabled={discovering || accountBusy}
                          onChange={(e) =>
                            setSettingsDraft((s) => ({
                              ...s,
                              model: e.target.value,
                              reasoningEffort: undefined,
                            }))
                          }
                        >
                          <option value="">Discover and select a model</option>
                          {settingsDraft.model &&
                            !models.some(
                              (m) =>
                                (typeof m === "string" ? m : m.id) ===
                                settingsDraft.model,
                            ) && (
                              <option value={settingsDraft.model}>
                                {settingsDraft.model}
                              </option>
                            )}
                          {models.map((m) => {
                            const id = typeof m === "string" ? m : m.id;
                            return (
                              <option key={id} value={id}>
                                {typeof m === "string" ? m : m.name}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          required
                          list="installed-models"
                          aria-label="Model"
                          placeholder="Select or enter an installed model"
                          value={settingsDraft.model}
                          onChange={(e) =>
                            setSettingsDraft((s) => ({
                              ...s,
                              model: e.target.value,
                            }))
                          }
                        />
                      )}
                      <button
                        type="button"
                        className="secondary"
                        disabled={discovering || accountBusy}
                        onClick={discover}
                      >
                        {discovering ? "Checking…" : "Discover"}
                      </button>
                    </div>
                    <datalist id="installed-models">
                      {models.map((m) => {
                        const id = typeof m === "string" ? m : m.id;
                        return <option key={id} value={id} />;
                      })}
                    </datalist>
                  </label>
                </>
              )}
              {settingsDraft.provider === "chatgpt" && (
                <>
                  <label>
                    Thinking effort
                    <select
                      aria-label="Thinking effort"
                      value={settingsDraft.reasoningEffort ?? ""}
                      disabled={accountBusy || !settingsDraft.model}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          reasoningEffort: (e.target.value || undefined) as
                            ReasoningEffort | undefined,
                        }))
                      }
                    >
                      <option value="">Model default</option>
                      <option value="none">None</option>
                      <option value="minimal">Minimal</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="xhigh">Extra high</option>
                      <option value="max">Maximum</option>
                    </select>
                  </label>
                  <p className="muted">
                    Higher effort can take longer and use more of your plan.
                    Supported levels vary by model; Model default lets the model
                    choose.
                  </p>
                </>
              )}
              <label>
                Custom instructions
                <textarea
                  aria-label="Custom instructions"
                  maxLength={MAX_CUSTOM_INSTRUCTIONS}
                  rows={8}
                  value={settingsDraft.customInstructions}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      customInstructions: e.target.value,
                    }))
                  }
                />
              </label>
              <p className="muted small">
                Apply to future Notes and generated synthesis across providers.
                Leave blank for the basic Noteboard guidance. Changes take
                effect when you save. Demo responses are scripted and do not
                follow these instructions.
              </p>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setSettingsDraft((s) => ({
                    ...s,
                    customInstructions: defaultCustomInstructions,
                  }))
                }
              >
                Restore response preferences
              </button>
              <p className="muted small">
                Noteboard cannot browse the web or access your ChatGPT projects
                or personalisation. Instructions used for a response are
                recorded with it and included in Board exports.
              </p>
              <div className="form-columns">
                <label>
                  Context budget (tokens)
                  <input
                    type="number"
                    min={1024}
                    max={1000000}
                    required
                    value={settingsDraft.contextLimit}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({
                        ...s,
                        contextLimit: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Depth reminder (steps)
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={settingsDraft.depthReminder}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({
                        ...s,
                        depthReminder: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <p className="muted small">
                Budgets include a 1,024-token response reserve. Context is
                estimated; no historical Notes are silently removed. Ollama
                model capability is checked before generation.
              </p>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button className="primary" disabled={accountBusy}>
                  Save settings <Check size={15} />
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={accountBusy}
                  onClick={() => setProviderOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {renameDraft !== undefined && board && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Rename Board"
          >
            <h2>Rename Board</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const title = renameDraft.trim();
                if (!title || title.length > 200) return;
                if (title !== board.title)
                  changeBoard((b) => ({ ...b, title }));
                setRenameDraft(undefined);
              }}
            >
              <label>
                Board name
                <input
                  data-modal-focus
                  required
                  maxLength={200}
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <div className="modal-actions">
                <button className="primary" disabled={!renameDraft.trim()}>
                  Save name
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setRenameDraft(undefined)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {deleteTarget && board && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={deleteTarget.noteId ? "Delete Note" : "Delete Board"}
          >
            <h2>
              {deleteTarget.noteId ? "Delete this Note?" : "Delete this Board?"}
            </h2>
            {deleteTarget.noteId ? (
              <>
                <p>
                  “
                  {board.notes.find((n) => n.id === deleteTarget.noteId)
                    ?.title ??
                    board.notes.find((n) => n.id === deleteTarget.noteId)
                      ?.prompt}
                  ” and its descendants will be removed:{" "}
                  {subtreeIds(board, deleteTarget.noteId).size} Notes in total.
                </p>
                <p>
                  Existing synthesis documents keep read-only copies of their
                  deleted source Notes.
                </p>
              </>
            ) : (
              <p>
                “{board.title}” and all its {board.notes.length} Notes and{" "}
                {board.artefacts.length} synthesis documents will be deleted.
              </p>
            )}
            <p>This cannot be undone.</p>
            {deleteError && (
              <p className="form-error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={deleting}
                onClick={() => setDeleteTarget(undefined)}
              >
                Cancel
              </button>
              <button
                className="danger"
                disabled={deleting}
                onClick={() => void confirmDeletion()}
              >
                {deleting
                  ? "Deleting…"
                  : deleteTarget.noteId
                    ? "Delete Note and descendants"
                    : "Delete Board permanently"}
              </button>
            </div>
          </section>
        </div>
      )}
      {sourcePreview && (
        <div className="modal-backdrop">
          <section
            className="modal archived-source"
            role="dialog"
            aria-modal="true"
            aria-label="Archived source Note"
          >
            <div className="panel-head">
              <span>ARCHIVED SOURCE NOTE</span>
              <button
                aria-label="Close source Note"
                onClick={() => setSourcePreview(undefined)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="muted">
              Deleted from the Board. This read-only source is preserved for
              synthesis provenance.
            </p>
            <h2>{sourcePreview.title ?? sourcePreview.prompt}</h2>
            {sourcePreview.title && <p>{sourcePreview.prompt}</p>}
            <p className="muted small">
              {response(sourcePreview).origin === "edited"
                ? "HUMAN-EDITED"
                : response(sourcePreview).provider === "demo"
                  ? "SYNTHETIC DEMO"
                  : response(sourcePreview).origin === "imported"
                    ? "Imported from ChatGPT"
                    : response(sourcePreview).provider}
              {" · Model: "}
              {response(sourcePreview).model ?? "Unknown"}
              {" · Source version: "}
              {response(sourcePreview).id}
            </p>
            <div className="prose">
              <Markdown
                text={response(sourcePreview).text}
                onSource={goSource}
              />
            </div>
          </section>
        </div>
      )}
      {synthOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Consolidate Notes"
          >
            <div className="panel-head">
              <span>
                <Sparkles size={16} /> CONSOLIDATE
              </span>
              <button
                aria-label="Close synthesis settings"
                disabled={busy}
                onClick={() => setSynthOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <h2>Turn your path into an account.</h2>
            <form onSubmit={consolidate}>
              <label>
                Source material
                <select
                  aria-label="Source material"
                  value={scope}
                  disabled={busy}
                  onChange={(e) => setScope(e.target.value as typeof scope)}
                >
                  <option value="board">
                    Entire Board ({board?.notes.length} Notes)
                  </option>
                  <option
                    value="branch"
                    disabled={!selected.length && !readerId}
                  >
                    Ancestral branch to the{" "}
                    {selected.length ? "first selected" : "open"} Note
                  </option>
                  <option value="selected" disabled={!selected.length}>
                    Selected Notes ({selected.length})
                  </option>
                </select>
              </label>
              <label>
                Output
                <select
                  aria-label="Output"
                  value={format}
                  disabled={busy}
                  onChange={(e) =>
                    setFormat(e.target.value as Artefact["format"])
                  }
                >
                  <option value="journey">
                    Learning journey — original prompts and responses
                  </option>
                  <option value="explanation">Integrated explanation</option>
                  <option value="structured">Structured artefact</option>
                </select>
              </label>
              {format === "structured" && (
                <label>
                  Document structure
                  <input
                    value={structure}
                    required
                    disabled={busy}
                    onChange={(e) => setStructure(e.target.value)}
                    placeholder="Study notes, research brief, tutorial…"
                  />
                </label>
              )}
              <p className="muted small">
                {format === "journey"
                  ? "Learning journeys preserve the original text and require no model request."
                  : settings.provider === "demo"
                    ? "Demo synthesis groups takeaways. Choose ChatGPT or Ollama for a model-generated explanation."
                    : "Your model will organise the sources and retain links to each Note."}{" "}
                Earlier artefacts are kept when you consolidate again. New
                synthesis uses the latest version of each selected Note.
              </p>
              {error && <p className="form-error">{error}</p>}
              {busy && (
                <div className="generation-progress" role="status">
                  <LoaderCircle className="spin" size={18} aria-hidden="true" />
                  Synthesising your sources…
                </div>
              )}
              <div className="modal-actions">
                {busy && (
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      cancelled.current = true;
                      if (generation.current)
                        void bridge.cancel(generation.current);
                    }}
                  >
                    Cancel generation
                  </button>
                )}
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}{" "}
                  {busy ? "Synthesising…" : "Create artefact"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
