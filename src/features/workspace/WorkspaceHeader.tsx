import {
  ArrowUpRight,
  LogIn,
  LogOut,
  FileText,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { type Board } from "../../core/model";
import { WorkspaceMenu } from "./WorkspaceMenu";
import { bridge } from "../../bridge";
import { ResponseProfilePicker } from "../../components/ResponseProfilePicker";
import {
  boardProfile,
  type ResponseProfile,
} from "../../core/response-profiles";

interface Props {
  sidebarVisible: boolean;
  board: Board | undefined;
  busy: boolean;
  importSaving: boolean;
  onToggleSidebar: () => void;
  onRename: () => void;
  onConsolidate: () => void;
  onAppearance: () => void;
  onImportBoard: () => void;
  onImportConversation: () => void;
  onExportBoard: () => void;
  onDeleteBoard: () => void;
  onResponseProfile: (profile: ResponseProfile) => void;
  profileDisabled?: boolean;
  onOpenLogs?: () => void;
}
export function WorkspaceHeader({
  sidebarVisible,
  onToggleSidebar,
  board,
  busy,
  onRename,
  onConsolidate,
  onAppearance,
  onImportBoard,
  importSaving,
  onImportConversation,
  onExportBoard,
  onDeleteBoard,
  onResponseProfile,
  profileDisabled,
  onOpenLogs,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar-start">
        <button
          className="sidebar-toggle"
          aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          aria-expanded={sidebarVisible}
          aria-controls="workspace-sidebar"
          onClick={onToggleSidebar}
        >
          {sidebarVisible ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeftOpen size={18} />
          )}
        </button>
        <div className="board-title-row">
          <h1 title={board?.title}>{board?.title}</h1>
          <button
            className="rename-board"
            aria-label="Rename Board"
            title="Rename Board"
            disabled={busy || !board}
            onClick={onRename}
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>
      <div className="topbar-actions">
        {board && (
          <ResponseProfilePicker
            label="Board response profile"
            value={boardProfile(board)}
            onChange={onResponseProfile}
            disabled={busy || profileDisabled}
            describe={false}
          />
        )}
        <button
          className="primary"
          disabled={busy || !board?.notes.length}
          onClick={onConsolidate}
        >
          <Sparkles size={15} /> Consolidate <ArrowUpRight size={15} />
        </button>
        <WorkspaceMenu>
          <button
            role="menuitem"
            tabIndex={-1}
            aria-label="Appearance settings"
            title="Appearance settings"
            onClick={onAppearance}
          >
            <Palette size={16} /> Appearance settings
          </button>
          <button
            role="menuitem"
            tabIndex={-1}
            title="Import a Board"
            aria-label="Import a Board"
            disabled={busy}
            onClick={onImportBoard}
          >
            <LogIn size={16} /> Import a Board
          </button>
          <button
            role="menuitem"
            tabIndex={-1}
            aria-label="Import ChatGPT conversation"
            title="Import ChatGPT conversation"
            disabled={busy || importSaving}
            onClick={onImportConversation}
          >
            <LogIn size={16} /> Import ChatGPT conversation
          </button>
          <button
            role="menuitem"
            tabIndex={-1}
            title="Export Board"
            aria-label="Export Board"
            onClick={onExportBoard}
          >
            <LogOut size={16} /> Export Board
          </button>
          {bridge.openDiagnosticLogs && (
            <button role="menuitem" tabIndex={-1} onClick={onOpenLogs}>
              <FileText size={16} /> Open diagnostic logs
            </button>
          )}

          <button
            role="menuitem"
            tabIndex={-1}
            aria-label="Delete Board"
            title="Delete Board"
            disabled={busy || !board}
            onClick={onDeleteBoard}
          >
            <Trash2 size={16} /> Delete Board
          </button>
        </WorkspaceMenu>
      </div>
    </header>
  );
}
