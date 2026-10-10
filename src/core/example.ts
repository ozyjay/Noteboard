import { newBoard, uid, now, type Board, type Note, response } from "./model";
import { buildContext, estimateTokens, takeaway } from "./context";
export function exampleBoard(): Board {
  const b = newBoard("How do complex systems work?");
  function add(
    prompt: string,
    text: string,
    position: { x: number; y: number },
    parent?: Note,
    passage?: string,
  ) {
    const highlight =
      parent && passage
        ? {
            sourceId: parent.id,
            versionId: response(parent).id,
            text: passage,
            start: response(parent).text.indexOf(passage),
            end: response(parent).text.indexOf(passage) + passage.length,
            surface: "markdown" as const,
          }
        : undefined;
    const context = buildContext(b, prompt, highlight);
    const n: Note = {
      id: uid(),
      prompt,
      takeaway: takeaway(text),
      position,
      createdAt: now(),
      versions: [
        {
          id: uid(),
          text,
          createdAt: now(),
          provider: "demo",
          model: "synthetic-demo",
          context,
          estimatedTokens: estimateTokens(context),
        },
      ],
    };
    b.notes.push(n);
    if (parent && highlight)
      b.edges.push({ id: uid(), source: parent.id, target: n.id, highlight });
    return n;
  }
  const root = add(
    "How do complex systems work?",
    "## More than the sum of their parts\n\nA complex system consists of many interacting parts. Their relationships can produce **emergence**: patterns that are difficult to predict by examining each part in isolation.\n\nThink of a flock of birds. Each bird follows local rules, yet the flock develops coordinated movement. Feedback loops can amplify or balance changes over time.\n\n### What to look for\n\n- Interactions between parts\n- Patterns at different scales\n- Feedback and delays\n- Adaptation to changing conditions\n\nThis is a synthetic example for exploring the interface, not a verified research source.\n\nTakeaway: To understand a complex system, examine the relationships between its parts as well as the parts themselves.",
    { x: 80, y: 160 },
  );
  add(
    "What is emergence?",
    "## Patterns from local interactions\n\nEmergence describes a collective pattern that arises through interactions among parts. No single part needs to contain a plan for the whole pattern.\n\nIn a flock, each bird responds to nearby birds. Coordinated movement appears at the group level. The same idea can help frame questions about ecosystems and social networks, although the mechanisms differ.\n\nEmergence is a description to investigate, rather than an explanation that replaces evidence.\n\nTakeaway: Local interactions can produce recognisable patterns at a larger scale.",
    { x: 490, y: 50 },
    root,
    "emergence",
  );
  add(
    "How do feedback loops change a system?",
    "## When effects become causes\n\nA feedback loop links a process’s output back to its input. Reinforcing feedback amplifies a change. Balancing feedback counteracts it.\n\nA thermostat provides a balancing example: heating stops as a room approaches the target temperature. Delays can cause overshoot, and constraints limit how far reinforcing change can grow.\n\nTakeaway: Feedback can amplify or stabilise change; its effects depend on delays and constraints.",
    { x: 490, y: 360 },
    root,
    "Feedback loops",
  );
  return b;
}
