import { useEffect } from "react";

// Keep each open/busy flag as a dependency: busy changes intentionally refocus the dialogue.
export function useDialogFocus(
  active: boolean[],
  blocked: boolean[],
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!active.some(Boolean)) return;
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
      if (event.key === "Escape" && !blocked.some(Boolean)) {
        onDismiss();
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
  }, [...active, ...blocked]);
}
