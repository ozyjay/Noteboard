import { z } from "zod";

export const GenerationActivitySchema = z.enum([
  "working",
  "thinking",
  "searching",
  "writing",
]);
export type GenerationActivity = z.infer<typeof GenerationActivitySchema>;
export const GenerationProgressSchema = z.object({
  id: z.string().min(1).max(200),
  activity: GenerationActivitySchema,
});
