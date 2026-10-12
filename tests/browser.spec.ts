import { test, expect } from "@playwright/test";
test("takeaway editing is collapsed and preserves the original response after reopening", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const readBoard = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("inquiry.boards")!)[0]);
  const original = await readBoard();
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  const editor = page.getByLabel("Edit Takeaway", { exact: true });
  await expect(editor).toBeHidden();
  await expect(page.locator(".reader-response")).toContainText(
    original.notes[0].takeaway,
  );
  const renderedResponse = await page.locator(".reader-response").textContent();
  await page.locator(".takeaway-controls summary").click();
  await expect(editor).toHaveValue(original.notes[0].takeaway);
  await editor.fill("Examine the relationships between the parts.");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const edited = await readBoard();
  expect(edited.notes[0].takeaway).toBe(
    "Examine the relationships between the parts.",
  );
  expect(edited.notes[0].versions).toEqual(original.notes[0].versions);
  expect(edited.edges).toEqual(original.edges);
  await expect(page.locator(".reader-response")).toHaveText(renderedResponse!);
  await page.reload();
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  await expect(editor).toBeHidden();
  await page.locator(".takeaway-controls summary").click();
  await expect(editor).toHaveValue(edited.notes[0].takeaway);
  await expect(page.locator(".reader-response")).toHaveText(renderedResponse!);
});

test("maths survives equation branching, synthesis editing and reopening", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Appearance settings", exact: true })
    .click();
  await page.getByLabel("Interface font").selectOption("monospace");
  await page.getByLabel("Reading font").selectOption("monospace");
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const source =
    String.raw`# Energy

**First** $E=mc^2$ then **second** $E=mc^2$.

\[\frac{1}{2}mv^2\]
` + "\nLiteral code: `$x$`.";
  await page.evaluate((text) => {
    const b = JSON.parse(localStorage.getItem("inquiry.boards")!)[0];
    b.notes = b.notes.slice(0, 1);
    b.edges = [];
    b.artefacts = [];
    b.notes[0].prompt = "Maths response";
    b.notes[0].versions[0].text = text;
    localStorage.setItem("inquiry.boards", JSON.stringify([b]));
  }, source);
  await page.reload();
  await page
    .getByRole("button", { name: "Maths response", exact: true })
    .click();
  await expect(page.locator(".reader-response .katex")).toHaveCount(3);
  await expect(page.locator(".reader-response code")).toHaveText("$x$");
  await page.locator(".reader-response").evaluate((root) => {
    const equation = root.querySelectorAll(".katex")[1];
    const range = document.createRange();
    range.selectNodeContents(equation);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue(String.raw`What is \(E=mc^2\)?`);
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Explain this equation");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0],
  );
  expect(saved.edges[0].highlight.latexSources).toEqual(["E=mc^2"]);
  expect(saved.edges[0].highlight.start).toBeGreaterThan(
    saved.edges[0].highlight.renderedText.indexOf("second"),
  );
  expect(saved.notes[1].versions[0].context.at(-1).content).toContain(
    String.raw`\[E=mc^2\]`,
  );
  expect(saved.notes[0].versions[0].text).toBe(source);
  await page.reload();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".react-flow__edge").click();
  await expect(page.locator(".reader-response .katex")).toHaveCount(3);
  expect(
    await page.evaluate(() => getSelection()?.getRangeAt(0).toString()),
  ).toBe(saved.edges[0].highlight.text);
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page.getByLabel("Output", { exact: true }).selectOption("journey");
  await page.getByRole("button", { name: "Create artefact" }).click();
  await expect(page.locator(".document-preview .katex")).toHaveCount(4);
  await expect(
    page.locator(".document-preview h1").filter({ hasText: "Energy" }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("maths-synthesis.png") });
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Synthesis document" });
  await editor.fill((await editor.inputValue()) + "\n\nReviewed $a^2$.");
  await page.getByRole("button", { name: "Save revision" }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await page.locator(".artefact-list button").first().click();
  await expect(page.locator(".document-preview .katex")).toHaveCount(5);
  await page
    .locator(".document-preview")
    .getByRole("button", { name: "Open source Note" })
    .first()
    .click();
  await expect(page.locator(".reader-response .katex")).toHaveCount(3);
});
test("older rendered Highlights retain their exact surface with maths enabled", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const b = JSON.parse(localStorage.getItem("inquiry.boards")!)[0];
    b.notes = b.notes.slice(0, 2);
    b.edges = b.edges.slice(0, 1);
    b.artefacts = [];
    delete b.viewport;
    b.notes[0].versions[0].text = "term $x^2$ term";
    b.edges[0].highlight = {
      sourceId: b.notes[0].id,
      versionId: b.notes[0].versions[0].id,
      text: "term",
      start: 11,
      end: 15,
      surface: "rendered",
      renderedText: "term $x^2$ term",
    };
    localStorage.setItem("inquiry.boards", JSON.stringify([b]));
  });
  await page.reload();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".react-flow__edge").click();
  await expect(page.locator(".reader-response .katex")).toHaveCount(0);
  expect(
    await page.evaluate(() => getSelection()?.getRangeAt(0).toString()),
  ).toBe("term");
  await page.getByRole("button", { name: "Close Note" }).click();
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  await expect(page.locator(".reader-response .katex")).toHaveCount(1);
});
test("highlight, branch, reload, synthesise, revise and return to a source", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "How do complex systems work?",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  await page.locator(".reader-response").evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const start = node.data.indexOf("emergence");
      if (start >= 0) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + 9);
        const s = window.getSelection()!;
        s.removeAllRanges();
        s.addRange(range);
        root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        break;
      }
    }
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue("What is emergence?");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How does emergence relate to feedback?");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".note-card")).toHaveCount(4);
  await expect(page.locator(".reader h2").first()).toHaveText(
    "How does emergence relate to feedback?",
  );
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Select Note 1 for synthesis" })
    .check();
  await page
    .getByRole("checkbox", { name: "Select Note 4 for synthesis" })
    .check();
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page.getByLabel("Output", { exact: true }).selectOption("journey");
  await page.getByRole("button", { name: "Create artefact" }).click();
  await expect(page.locator(".document-preview")).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Synthesis document" });
  expect(await editor.inputValue()).toContain(
    "How does emergence relate to feedback?",
  );
  expect(await editor.inputValue()).not.toContain(
    "## Patterns from local interactions",
  );
  await editor.fill(
    (await editor.inputValue()) + "\n\nMy reviewed conclusion.",
  );
  await page.getByRole("button", { name: "Save revision" }).click();
  await expect(page.getByLabel("Document version")).toContainText(
    "History · 2 versions",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page
    .locator(".document-preview")
    .getByRole("button", { name: "Open source Note" })
    .first()
    .click();
  await expect(page.locator(".reader h2").first()).toHaveText(
    "How do complex systems work?",
  );
  await expect(page.locator(".note-card")).toHaveCount(4);
  await page.reload();
  await page.locator(".artefact-list button").first().click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Synthesis document" }),
  ).toHaveValue(/My reviewed conclusion/);
});
test("selects a repeated occurrence across rich formatting with exact offsets", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  const selection = await page.locator(".reader-response").evaluate((root) => {
    const texts = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const all: Text[] = [];
    while (texts.nextNode()) all.push(texts.currentNode as Text);
    const start = all.find((n) => n.data.includes("Their relationships"))!;
    const end = all.find((n) => n.data === "emergence")!;
    const range = document.createRange();
    range.setStart(start, start.data.indexOf("Their"));
    range.setEnd(end, end.length);
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    return range.toString();
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue(`What is ${selection}?`);
});

test("persists the second repeated passage using its rendered offsets", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const b = JSON.parse(localStorage.getItem("inquiry.boards")!)[0];
    b.title = "Repeated passages";
    b.notes = b.notes.slice(0, 1);
    b.edges = [];
    b.artefacts = [];
    delete b.viewport;
    b.notes[0].prompt = "Repeated passages";
    b.notes[0].versions[0].text = "term and **term**";
    localStorage.setItem("inquiry.boards", JSON.stringify([b]));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Repeated passages", exact: true })
    .click();
  await page.locator(".reader-response").evaluate((root) => {
    const r = document.createRange();
    r.selectNodeContents(root.querySelector("strong")!);
    const selection = getSelection()!;
    selection.removeAllRanges();
    selection.addRange(r);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const anchor = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("inquiry.boards")!)[0].edges[0].highlight,
  );
  expect(anchor).toMatchObject({
    text: "term",
    start: 9,
    end: 13,
    surface: "rendered",
    renderedText: "term and term",
  });
  await page.getByRole("button", { name: "Close Note" }).click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".react-flow__edge").click();
  await expect(page.locator(".anchor-info")).toHaveText(
    "Source Highlight: “term”",
  );
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("term");
});

test("manual placement survives reopening the Board", async ({ page }) => {
  await page.goto("/");
  const label = page.locator(".note-number").first();
  await label.click();
  const box = (await label.boundingBox())!;
  const initial = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0].position,
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 90,
    box.y + box.height / 2 + 60,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
            .position.x,
      ),
    )
    .toBeGreaterThan(initial.x + 20);
  const placed = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0].position,
  );
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
          .position,
    ),
  ).toEqual(placed);
});

test("ChatGPT account settings and effective context survive branching and reopening", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const listeners = new Set<(event: { id: string; text: string }) => void>();
    let connected = true;
    const accounts = () => [
      {
        id: "test-client",
        label: "Test account · client",
        connected,
        planEnabled: connected,
      },
    ];
    window.inquiry = {
      listBoards: async () =>
        JSON.parse(localStorage.getItem("test.boards") || "[]"),
      saveBoard: async (board) => {
        const boards = JSON.parse(localStorage.getItem("test.boards") || "[]");
        const values = [
          board,
          ...boards.filter((value: { id: string }) => value.id !== board.id),
        ];
        values.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        localStorage.setItem("test.boards", JSON.stringify(values));
      },
      getSettings: async () =>
        JSON.parse(
          localStorage.getItem("test.settings") ||
            '{"provider":"demo","endpoint":"http://127.0.0.1:11434","model":"","contextLimit":8192,"depthReminder":8}',
        ),
      saveSettings: async (settings) => {
        localStorage.setItem("test.settings", JSON.stringify(settings));
      },
      chatgptAccounts: async () => accounts(),
      chatgptSignIn: async () => {
        connected = true;
        return accounts();
      },
      chatgptCancelSignIn: async () => {},
      chatgptSignOut: async () => {
        connected = false;
        return { revoked: true };
      },
      chatgptUsage: async () => {
        localStorage.setItem("test.usage", "opened");
      },
      models: async () => ["test-chatgpt-model"],
      generate: async (req) => {
        if (req.messages.some((message) => message.role === "system"))
          throw new Error("Unexpected system message");
        localStorage.setItem("test.request", JSON.stringify(req));
        const text =
          req.purpose === "explore"
            ? "## Example\n\nConnected ideas can support an inquiry.\n\nTakeaway: Follow connected ideas."
            : `# Explanation\n\nSelected Notes brought together.\n\n[Source Note](inquiry://note/${req.messages[1].content.match(/<note id="([^"]+)"/)?.[1]})`;
        listeners.forEach((listener) => listener({ id: req.id, text }));
        return {
          text,
          model: "test-chatgpt-model",
          usage: { input: 10, output: 5 },
        };
      },
      cancel: async () => {},
      onDelta: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Provider settings", exact: true })
    .click();
  await page.getByLabel("Provider", { exact: true }).selectOption("chatgpt");
  await expect(
    page.getByRole("button", { name: "Continue with ChatGPT" }),
  ).toBeVisible();
  await page
    .getByLabel("ChatGPT account", { exact: true })
    .selectOption("test-client");
  await page.getByRole("button", { name: "Manage usage", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("test.usage"))).toBe(
    "opened",
  );
  await page
    .getByRole("button", { name: "Continue with ChatGPT", exact: true })
    .click();
  await expect(
    page.getByText("You’re using your ChatGPT plan", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.getByLabel("Model", { exact: true }).fill("test-chatgpt-model");
  await page.screenshot({ path: "/tmp/noteboard-chatgpt-settings.png" });
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("button", { name: "New inquiry", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("My ChatGPT inquiry");
  await expect(
    page.getByText("Using ChatGPT plan", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ask & explore" }).click();
  await expect(page.locator(".note-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "My ChatGPT inquiry", exact: true })
    .click();
  await expect(page.locator(".reader-response")).toBeVisible();
  await page.locator(".reader-response").evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const start = node.textContent?.indexOf("Connected ideas") ?? -1;
      if (start >= 0) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + "Connected ideas".length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        break;
      }
    }
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.locator(".note-card")).toHaveCount(2);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("test.boards") || "[]"),
  );
  const child = saved[0].notes.at(-1);
  expect(child.versions[0].provider).toBe("chatgpt");
  expect(
    child.versions[0].context.map((message: { role: string }) => message.role),
  ).toEqual(["developer", "user", "assistant", "user"]);
  expect(child.versions[0].context).toEqual(
    (
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("test.request") || "{}"),
      )
    ).messages,
  );
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(2);
  await expect(page.getByText("ChatGPT plan", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page
    .getByRole("button", { name: "Create artefact", exact: true })
    .click();
  await expect(page.locator(".document-preview")).toBeVisible();
  await page
    .locator(".document-preview")
    .getByRole("button", { name: "Source Note", exact: true })
    .first()
    .click();
  await expect(page.locator(".reader h2").first()).toHaveText(
    "My ChatGPT inquiry",
  );

  await page
    .getByRole("button", { name: "Provider settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByText("Signed out of this ChatGPT account."),
  ).toBeVisible();
});

test("appearance previews, cancels, saves and follows system changes after reopening", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Appearance settings", exact: true })
    .click();
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.getByLabel("Note style").selectOption("sticky");
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "sticky",
  );
  await page.getByLabel("Accent colour").selectOption("blue");
  await page.getByLabel("Interface font").selectOption("monospace");
  await page.getByLabel("Reading font").selectOption("serif");
  await expect(page.locator("html")).toHaveAttribute(
    "data-interface-font",
    "monospace",
  );
  expect(
    await page
      .locator(".brand")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Consolas");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "classic",
  );
  await expect(page.locator("html")).toHaveAttribute("data-accent", "sage");
  await expect(page.locator("html")).toHaveAttribute(
    "data-interface-font",
    "standard",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-font",
    "sans",
  );
  await page
    .getByRole("button", { name: "Appearance settings", exact: true })
    .click();
  await page.getByLabel("Theme", { exact: true }).selectOption("system");
  await page.getByLabel("Note style").selectOption("sticky");
  await page.getByLabel("Accent colour").selectOption("plum");
  await page.getByLabel("Reading text size").selectOption("larger");
  await page.getByLabel("Show canvas grid").uncheck();
  await page.getByLabel("Interface font").selectOption("monospace");
  await page.getByLabel("Reading font").selectOption("monospace");
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "plum");
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "sticky",
  );
  expect(
    await page
      .locator(".note-card")
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").pointerEvents),
  ).toBe("none");
  await page.screenshot({ path: testInfo.outputPath("sticky-light.png") });
  await expect(page.locator("html")).toHaveAttribute(
    "data-text-size",
    "larger",
  );
  await expect(page.locator(".react-flow__background")).toHaveCount(0);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: testInfo.outputPath("dark-appearance.png") });
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  expect(
    await page
      .locator(".reader-response")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThan(18);
  await page.screenshot({
    path: testInfo.outputPath("dark-expanded-note.png"),
  });
  expect(
    await page
      .locator(".reader-response")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Consolas");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("inquiry.settings")!),
  );
  expect(stored.provider).toBe("demo");
  expect(stored.appearance).toEqual({
    noteStyle: "sticky",
    theme: "system",
    accent: "plum",
    textSize: "larger",
    showGrid: false,
    interfaceFont: "monospace",
    readingFont: "monospace",
  });
  await page
    .getByRole("button", { name: "Appearance settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Reset defaults" }).click();
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".react-flow__background")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "classic",
  );
});

test("expanded Note fills the workspace and retains passage navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  const sourceText = await page.locator(".reader-response").textContent();
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  const reader = (await page.locator(".reader").boundingBox())!;
  const body = (await page.locator(".exploration").boundingBox())!;
  expect(reader.width).toBe(body.width);
  expect(reader.height).toBe(body.height);
  await expect(page.locator(".reader-response")).toHaveText(sourceText!);
  await page.screenshot({ path: testInfo.outputPath("expanded-note.png") });
  await page
    .getByRole("button", { name: "Collapse Note", exact: true })
    .click();
  expect((await page.locator(".reader").boundingBox())!.width).toBeLessThan(
    body.width,
  );
  await page.getByRole("button", { name: "Close Note" }).click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".react-flow__edge").first().click();
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  expect(await page.evaluate(() => getSelection()?.toString())).not.toBe("");
  await page.locator(".reader-response").evaluate((root) => {
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await expect(
    page.getByRole("button", { name: "Explore this passage" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue(/^What is /);
});
