import { z } from "zod";

const effort = z.string().min(1).max(40);
export const ModelMetadataSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().max(300),
  reasoningEfforts: z
    .array(
      z.object({
        effort,
        description: z.string().max(2000).optional(),
      }),
    )
    .max(100)
    .optional(),
  defaultReasoningEffort: effort.optional(),
});
export const ModelCatalogueSchema = z.object({
  discoveredAt: z.iso.datetime(),
  models: z.array(ModelMetadataSchema).max(1000),
});
export type ModelMetadata = z.infer<typeof ModelMetadataSchema>;
export type ModelCatalogue = z.infer<typeof ModelCatalogueSchema>;
