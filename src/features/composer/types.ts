import type { Highlight, ReasoningEffort } from "../../core/model";
import type { Attachment } from "../../core/research";
import type { ResponseProfile } from "../../core/response-profiles";

export interface ComposerDraft {
  responseProfile: ResponseProfile;
  customInstructions: string;
  highlight?: Highlight;
  model: string;
  reasoningEffort?: ReasoningEffort;
  webSearch: boolean;
  files: Attachment[];
}
