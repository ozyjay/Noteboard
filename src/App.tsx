import { Compass } from "lucide-react";
import { useState } from "react";
import { newBoard } from "./core/model";
import { BoardDialogs } from "./features/boards/BoardDialogs";
import { BoardImports } from "./features/boards/BoardImports";
import { useBoardActions } from "./features/boards/useBoardActions";
import { useBoardFiles } from "./features/boards/useBoardFiles";
import { useBoardStore } from "./features/boards/useBoardStore";
import { BoardCanvas } from "./features/canvas/BoardCanvas";
import { useBoardCanvas } from "./features/canvas/useBoardCanvas";
import { NoteComposer } from "./features/composer/NoteComposer";
import { useNoteComposer } from "./features/composer/useNoteComposer";
import { useDialogFocus } from "./features/dialogues/useDialogFocus";
import { useGeneration } from "./features/generation/useGeneration";
import { ArchivedSource } from "./features/reader/ArchivedSource";
import { ReaderPanel } from "./features/reader/ReaderPanel";
import { RevisionDialog } from "./features/reader/RevisionDialog";
import { useReader } from "./features/reader/useReader";
import { useReaderHighlight } from "./features/reader/useReaderHighlight";
import { useSourceNavigation } from "./features/reader/useSourceNavigation";
import { AppearanceSettings } from "./features/settings/AppearanceSettings";
import { ProviderSettings } from "./features/settings/ProviderSettings";
import { useAppearance } from "./features/settings/useAppearance";
import { useProviderSettings } from "./features/settings/useProviderSettings";
import { SynthesisDialog } from "./features/synthesis/SynthesisDialog";
import { SynthesisWorkspace } from "./features/synthesis/SynthesisWorkspace";
import { useSynthesis } from "./features/synthesis/useSynthesis";
import { WorkspaceHeader } from "./features/workspace/WorkspaceHeader";
import { WorkspaceNavigation } from "./features/workspace/WorkspaceNavigation";
import { WorkspaceSidebar } from "./features/workspace/WorkspaceSidebar";
export default function App() {
  const [error, setError] = useState("");
  const store = useBoardStore(setError);
  const appearanceSettings = useAppearance(
    store.settings,
    store.setSettings,
    setError,
  );
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [mode, setMode] = useState<"explore" | "synthesis">("explore");
  const [selected, setSelected] = useState<string[]>([]);
  const board = store.boards.find((b) => b.id === store.boardId);
  const reader = useReader(board, setMode);
  const { busy, generate, cancelGeneration } = useGeneration(
    store.settings,
    setError,
  );
  const providerSettings = useProviderSettings({
    setSettings: store.setSettings,
    setError,
  });
  const composerState = useNoteComposer({
    board,
    settings: store.settings,
    ready: store.ready,
    busy,
    generate,
    changeBoard: store.changeBoard,
    setError,
    onCreated: reader.openCreatedNote,
  });
  const synthesis = useSynthesis({
    board,
    settings: store.settings,
    busy,
    selected,
    readerId: reader.readerId,
    generate,
    changeBoard: store.changeBoard,
    setMode,
    setError,
  });
  const boardActions = useBoardActions({
    store,
    busy,
    preserveDraft: synthesis.preserveDraft,
    resetPanels,
    onDeletedNotes: (ids) => {
      setSelected((current) => current.filter((id) => !ids.has(id)));
      if (reader.readerId && ids.has(reader.readerId))
        reader.setReaderId(undefined);
      reader.setAnchor(undefined);
      reader.setHighlight(undefined);
      reader.setContinuationTarget("");
    },
  });
  const files = useBoardFiles({
    store,
    board,
    withDocumentDraft: synthesis.withDocumentDraft,
    preserveDraft: synthesis.preserveDraft,
    resetPanels,
    setError,
  });
  useReaderHighlight({ ...reader, composerOpen: !!composerState.composer });
  useDialogFocus(
    [
      !!composerState.composer,
      providerSettings.providerOpen,
      synthesis.synthOpen,
      appearanceSettings.appearanceOpen,
      files.importOpen,
      !!boardActions.deleteTarget,
      !!reader.sourcePreview,
      !!reader.revisionTarget,
      boardActions.renameDraft !== undefined,
    ],
    [
      busy,
      providerSettings.accountBusy,
      appearanceSettings.appearanceSaving,
      files.importSaving,
      boardActions.deleting,
    ],
    () => {
      composerState.setComposer(null);
      providerSettings.setProviderOpen(false);
      synthesis.setSynthOpen(false);
      appearanceSettings.setAppearanceOpen(false);
      files.setImportOpen(false);
      boardActions.setDeleteTarget(undefined);
      reader.setSourcePreview(undefined);
      reader.setRevisionTarget(undefined);
      boardActions.setRenameDraft(undefined);
    },
  );
  const { nodes, edges, trackDimensions } = useBoardCanvas({
    board,
    boardId: store.boardId,
    ready: store.ready,
    readerId: reader.readerId,
    selected,
    appearance: appearanceSettings.appearance,
    read: reader.read,
    choose,
    changeBoard: store.changeBoard,
    openEdgeSource: reader.openEdgeSource,
  });
  const goSource = useSourceNavigation({
    board,
    mode,
    artefact: synthesis.artefact,
    activeArtefact: synthesis.activeArtefact,
    read: reader.read,
    setSourcePreview: reader.setSourcePreview,
    setError,
  });
  function choose(id: string) {
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
  }
  function resetPanels() {
    reader.resetReader();
    setSelected([]);
    setMode("explore");
    synthesis.resetDocument();
  }
  function createBoard() {
    if (busy) return;
    synthesis.preserveDraft();
    const b = newBoard();
    store.setBoards((bs) => [b, ...bs]);
    store.setBoardId(b.id);
    resetPanels();
    composerState.setPrompt("");
    composerState.openComposer();
  }
  if (!store.ready)
    return (
      <main className="loading">
        <Compass size={36} />
        <p>{error || "Opening your workspace…"}</p>
      </main>
    );
  return (
    <div className="app-shell">
      <WorkspaceSidebar
        sidebarVisible={sidebarVisible}
        createBoard={createBoard}
        busy={busy}
        boards={store.boards}
        boardId={store.boardId}
        boardMenu={boardActions.boardMenu}
        deleting={boardActions.deleting}
        setBoardMenu={boardActions.setBoardMenu}
        board={board}
        openDocument={synthesis.openDocument}
        settings={store.settings}
        saveStatus={store.saveStatus}
        onSelectBoard={(id) => {
          synthesis.preserveDraft();
          store.setBoardId(id);
          resetPanels();
        }}
        onOpenProvider={() => providerSettings.openSettings(store.settings)}
      />
      <main className="workspace">
        <WorkspaceHeader
          sidebarVisible={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible((v) => !v)}
          board={board}
          busy={busy}
          importSaving={files.importSaving}
          onRename={() => board && boardActions.requestRename(board.id)}
          onConsolidate={synthesis.openConsolidation}
          onAppearance={appearanceSettings.openAppearance}
          onImportBoard={() => files.fileInput.current?.click()}
          onImportConversation={files.openConversationImport}
          onExportBoard={files.exportCurrentBoard}
          onDeleteBoard={() => boardActions.requestDelete()}
        />
        <WorkspaceNavigation
          board={board}
          mode={mode}
          selectedCount={selected.length}
          error={error}
          onDismissError={() => setError("")}
          onMode={(next) => {
            if (next === "explore") synthesis.preserveDraft();
            setMode(next);
          }}
        />
        {mode === "explore" ? (
          <div className="exploration">
            <BoardCanvas
              readerExpanded={reader.readerExpanded}
              nodes={nodes}
              edges={edges}
              trackDimensions={trackDimensions}
              read={reader.read}
              changeBoard={store.changeBoard}
              openEdgeSource={reader.openEdgeSource}
              appearance={appearanceSettings.appearance}
              board={board}
              setPrompt={composerState.setPrompt}
              openComposer={composerState.openComposer}
            />
            {reader.note && (
              <ReaderPanel
                {...reader}
                board={board}
                busy={busy}
                onDeleteNote={() => boardActions.requestDelete(reader.note!.id)}
                changeBoard={store.changeBoard}
                appearance={appearanceSettings.appearance}
                goSource={goSource}
                branch={composerState.branch}
                note={reader.note!}
              />
            )}
          </div>
        ) : (
          <SynthesisWorkspace
            {...synthesis}
            goSource={goSource}
            board={board}
            setSynthOpen={synthesis.setSynthOpen}
          />
        )}
      </main>
      <BoardImports files={files} />
      <RevisionDialog
        board={board}
        settings={store.settings}
        busy={busy}
        generate={generate}
        onCancel={cancelGeneration}
        reader={reader}
        changeBoard={store.changeBoard}
        setError={setError}
      />
      {composerState.composer && (
        <NoteComposer
          {...composerState}
          busy={busy}
          settings={store.settings}
          board={board}
          setError={setError}
          error={error}
          onCancel={cancelGeneration}
          composer={composerState.composer!}
        />
      )}
      {appearanceSettings.appearanceOpen && (
        <AppearanceSettings
          value={appearanceSettings.appearanceDraft}
          onChange={appearanceSettings.setAppearanceDraft}
          saving={appearanceSettings.appearanceSaving}
          error={error}
          onClose={() => appearanceSettings.setAppearanceOpen(false)}
          onSave={appearanceSettings.saveAppearance}
        />
      )}
      {providerSettings.providerOpen && (
        <ProviderSettings
          {...providerSettings}
          setError={setError}
          error={error}
        />
      )}
      <BoardDialogs actions={boardActions} setBoards={store.setBoards} />
      {reader.sourcePreview && (
        <ArchivedSource
          setSourcePreview={reader.setSourcePreview}
          sourcePreview={reader.sourcePreview}
          goSource={goSource}
        />
      )}
      {synthesis.synthOpen && (
        <SynthesisDialog
          {...synthesis}
          busy={busy}
          setSynthOpen={synthesis.setSynthOpen}
          board={board}
          selected={selected}
          readerId={reader.readerId}
          settings={store.settings}
          error={error}
          onCancel={cancelGeneration}
        />
      )}
    </div>
  );
}
