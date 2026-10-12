import json from "./chatgpt-export.json" with { type: "json" };
export interface FixtureConversation {
  id: string;
  title: string;
  create_time?: number;
  current_node?: string;
  mapping: Record<
    string,
    {
      id: string;
      parent: string | null;
      children: string[];
      message: null | {
        id: string;
        author: { role: string };
        content: { content_type: string; parts: unknown[] };
        create_time?: number;
        status?: string;
        metadata?: Record<string, unknown>;
      };
    }
  >;
}
// Entirely synthetic export data; no real account or conversation information.
export const chatGPTExportFixture = json as unknown as FixtureConversation[];
