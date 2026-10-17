import {
  Check,
  Compass,
  FileText,
  Layers,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { type Artefact, type Board, type Settings } from "../../core/model";
import { type BoardMenuTarget } from "../boards/BoardMenu";

interface Props {
  onSelectBoard: (id: string) => void;
  onOpenProvider: () => void;
  sidebarVisible: boolean;
  createBoard: () => void;
  busy: boolean;
  boards: Board[];
  boardId: string;
  boardMenu: BoardMenuTarget | undefined;
  deleting: boolean;
  setBoardMenu: Dispatch<SetStateAction<BoardMenuTarget | undefined>>;
  board: Board | undefined;
  openDocument: (artefact: Artefact) => void;
  settings: Settings;
  saveStatus: string;
}
export function WorkspaceSidebar({
  onSelectBoard,
  onOpenProvider,
  sidebarVisible,
  createBoard,
  busy,
  boards,
  boardId,
  boardMenu,
  deleting,
  setBoardMenu,
  board,
  openDocument,
  settings,
  saveStatus,
}: Props) {
  const [search, setSearch] = useState("");
  return (
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
              title={b.title}
              disabled={busy}
              className={b.id === boardId ? "active" : ""}
              aria-haspopup="menu"
              aria-expanded={boardMenu?.boardId === b.id}
              onContextMenu={(event) => {
                event.preventDefault();
                if (busy || deleting) return;
                event.currentTarget.focus();
                setBoardMenu({
                  boardId: b.id,
                  x: event.clientX,
                  y: event.clientY,
                  trigger: event.currentTarget,
                });
              }}
              onKeyDown={(event) => {
                if (
                  event.key !== "ContextMenu" &&
                  !(event.shiftKey && event.key === "F10")
                )
                  return;
                event.preventDefault();
                if (busy || deleting) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                setBoardMenu({
                  boardId: b.id,
                  x: bounds.left,
                  y: bounds.bottom,
                  trigger: event.currentTarget,
                });
              }}
              onClick={() => onSelectBoard(b.id)}
            >
              <Layers size={16} />
              <span>
                <span className="board-list-title">{b.title}</span>
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
            <button key={a.id} disabled={busy} onClick={() => openDocument(a)}>
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
          onClick={onOpenProvider}
        >
          <Settings2 size={16} />
        </button>
      </div>
      <div className="local-status">
        <Check size={12} />
        {saveStatus}
      </div>
    </aside>
  );
}
