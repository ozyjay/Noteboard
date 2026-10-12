import { describe, it, expect } from "vitest";
import { exampleBoard } from "../src/core/example";
import {
  validateBoard,
  response,
  uid,
  newBoard,
  defaults,
  SettingsSchema,
} from "../src/core/model";
import {
  defaultCustomInstructions,
  MAX_CUSTOM_INSTRUCTIONS,
} from "../src/core/instructions";
import { providerMessages } from "../src/core/providers";
import {
  ancestry,
  buildContext,
  assertBudget,
  childPosition,
  takeaway,
} from "../src/core/context";
import {
  selectMaterial,
  journey,
  synthesisContext,
} from "../src/core/synthesis";
describe("Inquiry domain", () => {
  it("defaults old settings, preserves blank instructions and rejects oversized instructions", () => {
    const { customInstructions: _custom, ...legacy } = defaults;
    expect(SettingsSchema.parse(legacy).customInstructions).toBe(
      defaultCustomInstructions,
    );
    expect(
      SettingsSchema.parse({ ...legacy, customInstructions: "" })
        .customInstructions,
    ).toBe("");
    expect(() =>
      SettingsSchema.parse({
        ...defaults,
        customInstructions: "x".repeat(MAX_CUSTOM_INSTRUCTIONS + 1),
      }),
    ).toThrow();
  });
  it("records exact custom instructions without changing history, sources or previous versions", () => {
    const b = exampleBoard();
    const before = structuredClone(b);
    const instructions =
      "  Answer naturally.\nPreserve uncertainty and source identities.  ";
    const baseline = buildContext(b, "Why?", b.edges[0].highlight, "");
    const customised = buildContext(
      b,
      "Why?",
      b.edges[0].highlight,
      instructions,
    );
    expect(customised[0].content).toContain(
      `User custom instructions:\n${instructions}`,
    );
    expect(customised.slice(1)).toEqual(baseline.slice(1));
    expect(
      customised.some((m) => m.content === response(b.notes[2]).text),
    ).toBe(false);
    expect(baseline[0].content).not.toContain("User custom instructions:");
    expect(baseline[0].content).toContain(
      'a "Where this fits" section is optional',
    );
    expect(baseline[0].content).toContain(
      "Do not require a concluding Takeaway section",
    );
    expect(baseline[0].content).toContain("No web search");
    expect(baseline[0].content).toContain("outside ChatGPT projects");
    const effective = providerMessages(customised, "chatgpt");
    expect(effective[0]).toEqual({ ...customised[0], role: "developer" });
    expect(() =>
      assertBudget(
        buildContext(
          b,
          "Why?",
          b.edges[0].highlight,
          "x".repeat(MAX_CUSTOM_INSTRUCTIONS),
        ),
        2048,
      ),
    ).toThrow(/No history has been removed/);
    const synthesis = synthesisContext(
      b,
      [b.notes[0].id],
      "explanation",
      "",
      instructions,
    );
    expect(synthesis[0].content).toContain(instructions);
    expect(synthesis[1].content).toContain(response(b.notes[0]).text);
    expect(journey(b, [b.notes[0].id])).not.toContain(instructions);
    expect(b).toEqual(before);
  });
  it("includes root-to-parent history and excludes unrelated siblings", () => {
    const b = exampleBoard();
    const child = b.notes[1],
      sibling = b.notes[2];
    const context = buildContext(
      b,
      "Explain the mechanism",
      b.edges[0].highlight,
    );
    expect(context.map((m) => m.content).join("\n")).not.toContain(
      response(sibling).text,
    );
    expect(context[1].content).toBe(b.notes[0].prompt);
    expect(context[2].content).toBe(response(b.notes[0]).text);
    expect(context.at(-1)?.content).toContain("emergence");
    expect(ancestry(b, child.id).map((n) => n.id)).toEqual([
      b.notes[0].id,
      child.id,
    ]);
  });
  it("supports full multilevel ancestry without taking sibling context", () => {
    const b = exampleBoard();
    const p = b.notes[1],
      v = response(p),
      h = {
        sourceId: p.id,
        versionId: v.id,
        text: "local interactions",
        start: v.text.indexOf("local interactions"),
        end: v.text.indexOf("local interactions") + 18,
        surface: "markdown" as const,
      };
    const messages = buildContext(b, "Why?", h);
    expect(messages.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    expect(messages[4].content).toBe(v.text);
    expect(messages.some((m) => m.content === response(b.notes[2]).text)).toBe(
      false,
    );
  });
  it("rejects over-budget context without altering it", () => {
    const messages = [{ role: "user" as const, content: "x".repeat(12000) }];
    const before = structuredClone(messages);
    expect(() => assertBudget(messages, 2048)).toThrow(
      /No history has been removed/,
    );
    expect(messages).toEqual(before);
  });
  it("validates the sample and prevents ambiguous parents, cycles, roots and broken anchors", () => {
    const b = exampleBoard();
    expect(validateBoard(b)).toEqual(b);
    const altered = structuredClone(b);
    altered.edges[0].highlight!.start++;
    expect(() => validateBoard(altered)).toThrow(/provenance/);
    const multi = structuredClone(b);
    multi.edges.push({ ...multi.edges[0], id: uid() });
    expect(() => validateBoard(multi)).toThrow(/one existing parent/);
    const forest = structuredClone(b);
    forest.edges.pop();
    expect(() => validateBoard(forest)).toThrow(/rooted tree/);
    const cyclic = structuredClone(b);
    cyclic.edges.push({
      ...cyclic.edges[0],
      id: uid(),
      source: cyclic.notes[1].id,
      target: cyclic.notes[0].id,
      highlight: {
        ...cyclic.edges[0].highlight!,
        sourceId: cyclic.notes[1].id,
        versionId: response(cyclic.notes[1]).id,
        text: response(cyclic.notes[1]).text.slice(0, 5),
        start: 0,
        end: 5,
      },
    });
    expect(() => validateBoard(cyclic)).toThrow(/Cycles/);
  });
  it("keeps repeated passages independently anchored", () => {
    const b = exampleBoard(),
      n = b.notes[0],
      v = response(n);
    v.text = "term and term";
    b.notes = b.notes.slice(0, 1);
    b.edges = [];
    const child = { ...structuredClone(n), id: uid() };
    b.notes.push(child);
    b.edges.push({
      kind: "highlight",
      id: uid(),
      source: n.id,
      target: child.id,
      highlight: {
        sourceId: n.id,
        versionId: v.id,
        text: "term",
        start: 9,
        end: 13,
        surface: "markdown",
      },
    });
    expect(validateBoard(b).edges[0].highlight!.start).toBe(9);
  });
  it("keeps manual positions while finding room for a child", () => {
    const b = exampleBoard(),
      original = structuredClone(b);
    const pos = childPosition(b, b.notes[0]);
    expect(b).toEqual(original);
    expect(
      b.notes.every(
        (n) =>
          Math.abs(n.position.x - pos.x) >= 330 ||
          Math.abs(n.position.y - pos.y) >= 250,
      ),
    ).toBe(true);
  });
  it("uses an explicit principal takeaway rather than a final sentence", () => {
    expect(
      takeaway("An important principal point.\n\nUnrelated closing sentence."),
    ).toBe("An important principal point.");
    expect(takeaway("Explanation\n\nTakeaway: Relationships matter.")).toBe(
      "Relationships matter.",
    );
  });
  it("selects branches and preserves original sources in learning journeys", () => {
    const b = exampleBoard();
    const ids = selectMaterial(b, "branch", [b.notes[1].id]);
    expect(ids).toEqual([b.notes[0].id, b.notes[1].id]);
    const text = journey(b, ids);
    expect(text).toContain(response(b.notes[1]).text);
    expect(text).toContain(`inquiry://note/${b.notes[1].id}`);
    expect(text).not.toContain(response(b.notes[2]).text);
    expect(selectMaterial(b, "selected", [b.notes[2].id])).toEqual([
      b.notes[2].id,
    ]);
    expect(() => selectMaterial(newBoard(), "board", [])).toThrow(
      /at least one/,
    );
    expect(
      synthesisContext(b, ids, "structured", "Research brief")[0].content,
    ).toContain("Research brief");
  });
});
