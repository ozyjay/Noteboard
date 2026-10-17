import type { Highlight, ReasoningEffort } from "../../core/model";
import type { Attachment } from "../../core/research";

export interface ComposerDraft {
  highlight?: Highlight;
  model: string;
  reasoningEffort?: ReasoningEffort;
  webSearch: boolean;
  files: Attachment[];
}
