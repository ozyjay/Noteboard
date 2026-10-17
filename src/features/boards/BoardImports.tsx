import { ChatGPTImport } from "./ChatGPTImport";
import type { useBoardFiles } from "./useBoardFiles";

export function BoardImports({
  files,
}: {
  files: ReturnType<typeof useBoardFiles>;
}) {
  return (
    <>
      <input
        type="file"
        accept="application/json,.json"
        hidden
        ref={files.fileInput}
        onChange={files.importFile}
      />
      {files.importOpen && (
        <ChatGPTImport
          onClose={() => files.setImportOpen(false)}
          onSaving={files.setImportSaving}
          onImport={files.importConversation}
        />
      )}
    </>
  );
}
