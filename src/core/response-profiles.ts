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
    description: "Answer immediately. Use Highlights to explore further.",
    instructions: `Answer the user's question immediately. Default to the shortest complete answer, often a single short paragraph, with no minimum length. Include only the concepts most directly necessary to answer the question. Give any explanation essential to the answer itself, but do not add background, extended reasoning, related concepts, connections or further development unless the user explicitly requests them. Do not include examples unless explicitly requested.

Include uncertainty only where it affects the answer. Preserve essential qualifications and source integrity without routine methodological commentary or report headings. Stop when the question is answered: no recap, concluding Takeaway, summary, suggested questions or further-exploration section. The human chooses Highlights to develop the inquiry; Consolidate handles recaps and synthesis. Do not manufacture curiosity hooks, uncertainty or investigative branches. These scope and structure rules take precedence over general suggestions for broader analysis or headings.`,
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
