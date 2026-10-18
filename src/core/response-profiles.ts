import { z } from "zod";
import { defaultCustomInstructions } from "./instructions";

export const ResponseProfileSchema = z.enum([
  "explore",
  "direct",
  "evaluate",
  "custom",
]);
export type ResponseProfile = z.infer<typeof ResponseProfileSchema>;

export const responseProfiles = {
  explore: {
    label: "Explore",
    description:
      "Understand mechanisms, connections and questions worth investigating.",
    instructions: `Answer the question directly, then develop the explanation to support understanding and inquiry. Explain how and why things work. Where useful, introduce meaningful distinctions, name relevant concepts and show their significance through a concrete example. Connect ideas within the supplied ancestral conversation without implying access to other Notes.

Identify genuine assumptions, limits, tensions or unresolved questions when they matter. Write coherent passages that remain meaningful when selected for closer investigation. Give a complete, useful answer: do not manufacture uncertainty, withhold an explanation to create curiosity, add artificial hooks or routinely finish with a list of follow-up questions. The human decides what to Highlight and whether to create a branch. Use a natural structure suited to the question.`,
  },
  direct: {
    label: "Direct answer",
    description: "Resolve a specific question or task efficiently.",
    instructions: `Lead with the answer or recommended action. Include the explanation, example or steps needed to use it confidently. Keep the response concise and proportionate to the task without omitting material qualifications. Avoid unnecessary background, exploratory tangents and routine follow-up questions.`,
  },
  evaluate: {
    label: "Critically evaluate",
    description:
      "Examine evidence, assumptions, alternatives and ways to verify claims.",
    instructions: `Assess the question or claim fairly. Distinguish evidence from inference and assumptions; identify material uncertainty, counterarguments, plausible alternatives and trade-offs. Explain what would strengthen or weaken the conclusion and how important uncertainties could be verified. Make a clear recommendation when the evidence supports one. Use What I know, What I'm unsure about, How I'd verify, and Sources / Tools used only when those headings improve clarity. Do not force a report structure onto a simple answer or manufacture balance where the evidence is one-sided.`,
  },
  custom: {
    label: "Custom",
    description:
      "Use your saved custom instructions, or customise this request.",
    instructions: "",
  },
} satisfies Record<
  ResponseProfile,
  { label: string; description: string; instructions: string }
>;

// Missing metadata preserves existing Boards' response preferences.
export const boardProfile = (board?: { responseProfile?: ResponseProfile }) =>
  board?.responseProfile ?? "custom";

export function profileInstructions(profile: ResponseProfile, custom: string) {
  if (profile === "custom") return custom;
  return `${defaultCustomInstructions}\n\n# Response profile: ${responseProfiles[profile].label}\n${responseProfiles[profile].instructions}`;
}
