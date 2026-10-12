# Import a ChatGPT conversation

Choose **Import ChatGPT conversation** in the top toolbar and select an extracted `conversations.json` file. ZIP archives and pasted transcripts are not supported. The file must contain a conversation array with message mapping nodes, identities, parent/child references, author roles and text parts. Each conversation must have one rooted message tree.

Search conversation titles, choose a conversation, and review a root-to-end path. The current exported path is selected when supported; otherwise select a path explicitly. Alternative paths remain in the export file. Review every question and answer, edit the Board title if needed, then choose **Import conversation**. Import runs locally without inference or sign-in. Cancel saves nothing. A save failure retains the preview for retry.

The first version accepts complete alternating user/assistant text turns. Text parts are joined with newlines; original spacing, Markdown and LaTeX are retained. Unsupported tools, attachments, images, unfinished turns, non-text content and malformed mappings are rejected with an explanation. System/developer records are excluded with a visible count and never used as current instructions. Files above 50 MiB and conversations above 20,000 nodes are rejected without truncation. Unfamiliar export variants may require importer updates.

## Continue exploring

One chosen path becomes one new Board, with Notes arranged left to right. Dashed **Imported continuation** connections record chronology; clicking one opens the preceding Note. Imported responses show source identities, available dates and model metadata. Original inference messages, token estimates and usage are unknown; missing model metadata displays **Unknown**. Only the chosen path and its provenance are saved, not unrelated account data or other conversations.

Select a passage in the preceding Note and choose **Attach Highlight to imported follow-up** to annotate a continuation retrospectively. Choose the target if several continuations originate there. Selecting a new passage and attaching it replaces the annotation; **Remove Highlight** removes only the annotation. A **Retrospective Highlight** records your later confirmation, without changing the original conversation or claiming it motivated the original follow-up. No AI Highlight proposals run in this version.

Use **Explore this passage** to create a normal branch from any imported Note. Future generation includes the complete ancestral prompts and responses, selected passage and new prompt, without siblings or hidden ChatGPT context. Context budgets remain enforced without automatic summarisation or truncation. Notes also work with synthesis and source navigation.

## Storage compatibility

Boards now write/export JSON schema version 2. Version 1 Boards are validated and upgraded deterministically in memory, retaining identifiers, positions, anchors, contexts and artefacts. SQLite tables are unchanged. Board JSON imports accept files up to 50 MiB. Version 2 exports retain imported provenance and retrospective anchors; older Noteboard versions cannot read them. Reimporting creates a new Board with fresh internal identifiers. Provider settings and credentials are excluded from Board exports.
