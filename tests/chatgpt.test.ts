import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateKeyPairSync,
  sign,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ChatGPTAuth,
  verifyIdentity,
  type CredentialCipher,
} from "../electron/chatgpt-auth";
import { chatGPTProvider } from "../electron/chatgpt";
import { defaults, uid, SettingsSchema } from "../src/core/model";
import {
  providerMessages,
  type GenerationRequest,
} from "../src/core/providers";
const realFetch = globalThis.fetch;
afterEach(() => vi.unstubAllGlobals());
const tokenResponse = (access = "private-access", expires = 3600) => ({
  access_token: access,
  refresh_token: "private-refresh",
  id_token: "private-id",
  token_type: "Bearer",
  expires_in: expires,
  scope: "openid chatgpt.tokens.use.direct offline_access",
});
function request(): GenerationRequest {
  return {
    id: uid(),
    purpose: "explore",
    settings: {
      ...defaults,
      provider: "chatgpt",
      model: "account-model",
      chatgptAccountId: "issued-client",
    },
    messages: providerMessages(
      [
        { role: "system", content: "Help" },
        { role: "user", content: "Root" },
        { role: "assistant", content: "Ancestor" },
        { role: "user", content: "Selected passage and question" },
      ],
      "chatgpt",
    ),
  };
}
function stream(events: object[], terminal = true) {
  const content =
    events
      .map(
        (event) =>
          `event: ${"type" in event ? event.type : "event"}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`,
      )
      .join("") + (terminal ? "data: [DONE]\r\n\r\n" : "");
  const bytes = new TextEncoder().encode(content);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 7)
          controller.enqueue(bytes.slice(i, i + 7));
        controller.close();
      },
    }),
  );
}
describe("ChatGPT plan provider", () => {
  it("discovers account models and streams exact effective context with usage", async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        expect(init.headers).toMatchObject({
          Authorization: "Bearer private-access",
        });
        if (url.endsWith("/models"))
          return Response.json({
            models: [
              {
                slug: "account-model",
                display_name: "Account Model",
                visibility: "list",
              },
              { slug: "hidden", display_name: "Hidden", visibility: "hidden" },
            ],
          });
        sent.push(JSON.parse(init.body as string));
        return stream([
          { type: "response.output_text.delta", delta: "Hello 🌏" },
          {
            type: "response.completed",
            response: {
              model: "resolved-model",
              usage: { input_tokens: 12, output_tokens: 4 },
            },
          },
        ]);
      }),
    );
    const accessToken = vi.fn(async () => "private-access");
    const provider = chatGPTProvider({ accessToken });
    const req = request();
    expect(await provider.models(req.settings)).toEqual([
      { id: "account-model", name: "Account Model" },
    ]);
    const deltas: string[] = [];
    expect(
      await provider.generate(
        req,
        (text) => deltas.push(text),
        new AbortController().signal,
      ),
    ).toEqual({
      text: "Hello 🌏",
      model: "resolved-model",
      usage: { input: 12, output: 4 },
    });
    expect(sent).toEqual([
      {
        model: "account-model",
        input: req.messages,
        store: false,
        stream: true,
      },
    ]);
    expect(req.messages[0].role).toBe("developer");
    expect(deltas).toEqual(["Hello 🌏"]);
    expect(accessToken).toHaveBeenCalledWith("issued-client");
  });
  it.each(["low", "medium", "high", "xhigh", "max"] as const)(
    "transmits and records explicit %s thinking effort",
    async (effort) => {
      const req = request();
      req.settings.reasoningEffort = effort;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url, init: RequestInit) => {
          expect(JSON.parse(init.body as string)).toMatchObject({
            model: req.settings.model,
            input: req.messages,
            reasoning: { effort },
            store: false,
            stream: true,
          });
          return stream([
            { type: "response.output_text.delta", delta: "Answer" },
            { type: "response.completed", response: {} },
          ]);
        }),
      );
      const result = await chatGPTProvider({
        accessToken: async () => "token",
      }).generate(req, () => {}, new AbortController().signal);
      expect(result.reasoningEffort).toBe(effort);
    },
  );
  it("reports unsupported effort without retrying or changing the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { code: "unsupported_value", message: "private details" } },
          { status: 400 },
        ),
      ),
    );
    const req = request();
    req.settings.reasoningEffort = "max";
    await expect(
      chatGPTProvider({ accessToken: async () => "token" }).generate(
        req,
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toThrow(/Model default/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("sends inline files with web search and retains completed calls and citation ranges", async () => {
    const req = request();
    req.settings.webSearch = true;
    const file = {
      name: "reference.txt",
      size: 5,
      data: "data:text/plain;base64,SGVsbG8=",
    };
    req.messages.at(-1)!.files = [file];
    const text = "Evidence [source]";
    const output = [
      {
        type: "web_search_call",
        id: "search-1",
        status: "completed",
        action: {
          type: "search",
          queries: ["reference evidence"],
          sources: [
            {
              type: "url",
              url: "https://example.org/evidence",
              title: "Evidence",
            },
          ],
        },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text,
            annotations: [
              {
                type: "url_citation",
                start_index: 9,
                end_index: 17,
                url: "https://example.org/evidence",
                title: "Evidence",
              },
            ],
          },
        ],
      },
    ];
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string));
        return stream([
          { type: "response.output_text.delta", delta: text },
          { type: "response.completed", response: { output } },
        ]);
      }),
    );
    const provider = chatGPTProvider({ accessToken: async () => "token" });
    const result = await provider.generate(
      req,
      () => {},
      new AbortController().signal,
    );
    expect(bodies[0].tools).toEqual([{ type: "web_search" }]);
    expect(bodies[0].include).toEqual(["web_search_call.action.sources"]);
    expect(bodies[0].input).toEqual([
      ...req.messages.slice(0, -1),
      {
        role: "user",
        content: [
          { type: "input_text", text: req.messages.at(-1)!.content },
          { type: "input_file", filename: file.name, file_data: file.data },
        ],
      },
    ]);
    expect(result.text).toBe(text);
    expect(result.webResearch).toEqual({
      requested: true,
      searched: true,
      calls: [
        { id: "search-1", status: "completed", action: output[0].action },
      ],
      citations: [
        {
          start: 9,
          end: 17,
          url: "https://example.org/evidence",
          title: "Evidence",
        },
      ],
    });
    req.settings.webSearch = false;
    await provider.generate(req, () => {}, new AbortController().signal);
    expect(bodies[1]).not.toHaveProperty("tools");
    expect(bodies[1]).not.toHaveProperty("include");
    expect(bodies[1].input).toEqual(bodies[0].input);
  });
  it("records search as unused when no completed search call is returned", async () => {
    const req = request();
    req.settings.webSearch = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stream([
          { type: "response.output_text.delta", delta: "No search needed" },
          { type: "response.completed", response: {} },
        ]),
      ),
    );
    const result = await chatGPTProvider({
      accessToken: async () => "token",
    }).generate(req, () => {}, new AbortController().signal);
    expect(result.webResearch).toEqual({
      requested: true,
      searched: false,
      calls: [],
      citations: [],
    });
  });
  it.each([
    [{ type: "response.output_text.delta", delta: "Partial" }],
    [{ type: "response.incomplete", response: {} }],
    [
      {
        type: "response.failed",
        response: {
          error: { code: "subscription_sharing_usage_limit_exceeded" },
        },
      },
    ],
    [{ type: "error", code: "unknown" }],
    [{ type: "response.completed", response: {} }],
  ])(
    "rejects incomplete, failed, empty and interrupted responses",
    async (event) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => stream([event])),
      );
      await expect(
        chatGPTProvider({ accessToken: async () => "token" }).generate(
          request(),
          () => {},
          new AbortController().signal,
        ),
      ).rejects.toThrow();
    },
  );
  it("honours cancellation after a delta and refuses oversized contexts before token access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stream([
          { type: "response.output_text.delta", delta: "Partial" },
          { type: "response.completed", response: {} },
        ]),
      ),
    );
    const controller = new AbortController();
    const accessToken = vi.fn(async () => "token");
    const provider = chatGPTProvider({ accessToken });
    await expect(
      provider.generate(request(), () => controller.abort(), controller.signal),
    ).rejects.toThrow();
    accessToken.mockClear();
    const req = request();
    req.messages.push({ role: "user", content: "x".repeat(30000) });
    await expect(
      provider.generate(req, () => {}, new AbortController().signal),
    ).rejects.toThrow(/No history has been removed/);
    expect(accessToken).not.toHaveBeenCalled();
  });
  it("does not expose remote error bodies or use an API key fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { detail: "private-access private-refresh" },
          { status: 403 },
        ),
      ),
    );
    await expect(
      chatGPTProvider({ accessToken: async () => "private-access" }).generate(
        request(),
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toThrow(/access was denied/);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
const key = randomBytes(32);
const cipher: CredentialCipher = {
  available: () => true,
  encrypt(text) {
    const iv = randomBytes(12),
      encrypt = createCipheriv("aes-256-gcm", key, iv);
    return Buffer.concat([
      iv,
      encrypt.update(text),
      encrypt.final(),
      encrypt.getAuthTag(),
    ]);
  },
  decrypt(value) {
    const decrypt = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
    decrypt.setAuthTag(value.subarray(-16));
    return Buffer.concat([
      decrypt.update(value.subarray(12, -16)),
      decrypt.final(),
    ]).toString();
  },
};
describe("ChatGPT OAuth and protected credentials", () => {
  it("registers, reopens, refreshes once and signs out while retaining the issued registration", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "noteboard-chatgpt-"));
    const filename = path.join(dir, "credentials.bin");
    const urls: URL[] = [],
      exchanges: URLSearchParams[] = [];
    let issued = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input).startsWith("http://127.0.0.1:"))
          return realFetch(input, init);
        if (String(input).endsWith("/revoke"))
          return new Response(null, { status: 200 });
        exchanges.push(new URLSearchParams(init?.body as URLSearchParams));
        return Response.json(
          tokenResponse(`private-access-${++issued}`, issued === 1 ? 1 : 3600),
        );
      }),
    );
    const browser = async (raw: string) => {
      const url = new URL(raw);
      urls.push(url);
      const callback = new URL(url.searchParams.get("redirect_uri")!);
      callback.search = new URLSearchParams({
        state: url.searchParams.get("state")!,
        client_id: "issued-client",
        code: "code",
      }).toString();
      expect((await fetch(callback)).status).toBe(200);
    };
    const identity = vi.fn(
      async (_token: string, _client: string, nonce: string) => {
        expect(nonce).toBe(urls.at(-1)!.searchParams.get("nonce"));
        return { subject: "verified-user", email: "user@example.com" };
      },
    );
    try {
      const auth = new ChatGPTAuth(filename, cipher, browser, identity);
      const accounts = await auth.signIn();
      expect(accounts).toMatchObject([
        { id: "issued-client", connected: true, planEnabled: true },
      ]);
      expect(urls[0].searchParams.get("client_id")).toBe(
        "dynamic_agent_client",
      );
      expect(urls[0].searchParams.get("agent_name_hint")).toBe("Noteboard");
      expect(exchanges[0].get("client_id")).toBe("issued-client");
      expect(exchanges[0].get("redirect_uri")).toBe(
        urls[0].searchParams.get("redirect_uri"),
      );
      expect(readFileSync(filename).toString()).not.toContain("private-access");
      expect(statSync(filename).mode & 0o777).toBe(0o600);
      const reopened = new ChatGPTAuth(filename, cipher, browser, identity);
      expect(reopened.accounts()).toEqual(accounts);
      expect(
        await Promise.all([
          reopened.accessToken("issued-client"),
          reopened.accessToken("issued-client"),
        ]),
      ).toEqual(["private-access-2", "private-access-2"]);
      expect(
        exchanges.filter((e) => e.get("grant_type") === "refresh_token"),
      ).toHaveLength(1);
      expect(await reopened.signOut("issued-client")).toEqual({
        revoked: true,
      });
      await expect(reopened.accessToken("issued-client")).rejects.toThrow(
        /Continue with ChatGPT/,
      );
      await reopened.signIn("issued-client");
      expect(urls[1].searchParams.get("client_id")).toBe("issued-client");
      expect(urls[1].searchParams.get("agent_name_hint")).toBeNull();
      expect(urls[1].searchParams.get("ext_agent_host_id")).toBe(
        urls[0].searchParams.get("ext_agent_host_id"),
      );
      expect(urls[1].searchParams.get("id_token_hint")).toBeNull();
      expect(
        SettingsSchema.parse({ ...defaults, secret: "private-access" }),
      ).not.toHaveProperty("secret");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("rejects mismatched callbacks, permits cancellation and refuses insecure storage", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "noteboard-chatgpt-"));
    let auth: ChatGPTAuth;
    try {
      auth = new ChatGPTAuth(
        path.join(dir, "credentials.bin"),
        cipher,
        async (raw) => {
          const url = new URL(raw),
            callback = new URL(url.searchParams.get("redirect_uri")!);
          callback.search = "?state=incorrect&code=code&client_id=issued";
          expect((await realFetch(callback)).status).toBe(400);
          auth.cancel();
        },
      );
      await expect(auth.signIn()).rejects.toThrow(/cancelled/);
      expect(auth.accounts()).toEqual([]);
      const insecure = new ChatGPTAuth(
        path.join(dir, "other.bin"),
        { ...cipher, available: () => false },
        async () => {},
      );
      await expect(insecure.signIn()).rejects.toThrow(
        /Secure credential storage/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps independent registrations separate during refresh and clears terminally expired sessions", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "noteboard-chatgpt-"));
    const filename = path.join(dir, "credentials.bin");
    writeFileSync(
      filename,
      cipher.encrypt(
        JSON.stringify({
          hostId: "urn:uuid:test-host",
          accounts: ["a", "b"].map((id) => ({
            clientId: id,
            subject: `subject-${id}`,
            email: "same@example.com",
            tokens: { ...tokenResponse(`access-${id}`, 1), expiresAt: 0 },
          })),
        }),
      ),
    );
    let release: (response: Response) => void = () => {};
    let refreshing = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/revoke")) return new Response(null, { status: 200 });
        expect(
          new URLSearchParams(init.body as URLSearchParams).get("client_id"),
        ).toBe("a");
        if (refreshing)
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        refreshing = true;
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }),
    );
    try {
      const auth = new ChatGPTAuth(filename, cipher, async () => {});
      const renewal = auth.accessToken("a");
      await auth.signOut("b");
      release(Response.json(tokenResponse("renewed-a", 1)));
      expect(await renewal).toBe("renewed-a");
      expect(
        auth.accounts().map((account) => [account.id, account.connected]),
      ).toEqual([
        ["a", true],
        ["b", false],
      ]);
      await expect(auth.accessToken("a")).rejects.toThrow(/session expired/);
      expect(
        auth.accounts().map((account) => [account.id, account.connected]),
      ).toEqual([
        ["a", false],
        ["b", false],
      ]);
      await expect(auth.accessToken("b")).rejects.toThrow(
        /Continue with ChatGPT/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("verifies identity signatures, issuer, audience, nonce and expiry", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          keys: [{ ...publicKey.export({ format: "jwk" }), kid: "test" }],
        }),
      ),
    );
    const jwt = (overrides = {}) => {
      const header = Buffer.from(
          JSON.stringify({ alg: "RS256", kid: "test" }),
        ).toString("base64url"),
        body = Buffer.from(
          JSON.stringify({
            iss: "https://auth.openai.com",
            aud: "client",
            sub: "user",
            nonce: "nonce",
            exp: Date.now() / 1000 + 600,
            ...overrides,
          }),
        ).toString("base64url");
      const unsigned = `${header}.${body}`;
      return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url")}`;
    };
    expect(await verifyIdentity(jwt(), "client", "nonce")).toMatchObject({
      subject: "user",
    });
    for (const overrides of [
      { nonce: "wrong" },
      { aud: "other" },
      { aud: ["client", "other"], azp: "other" },
      { exp: 0 },
      { iss: "https://other.example" },
    ])
      await expect(
        verifyIdentity(jwt(overrides), "client", "nonce"),
      ).rejects.toThrow();
    const token = jwt();
    await expect(
      verifyIdentity(token.slice(0, -8) + "invalid!", "client", "nonce"),
    ).rejects.toThrow();
  });
});
