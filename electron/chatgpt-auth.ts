import {
  randomBytes,
  randomUUID,
  createHash,
  createPublicKey,
  verify,
} from "node:crypto";
import { createServer } from "node:http";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
  chmodSync,
} from "node:fs";
import path from "node:path";
import { z } from "zod";
import { type ChatGPTAccount } from "../src/bridge";
const issuer = "https://auth.openai.com";
const resource = "https://api.openai.com/v1";
const permission = "chatgpt.tokens.use.direct";
const Tokens = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  id_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number().positive(),
  scope: z.string(),
});
const Registration = z.object({
  clientId: z.string().min(1),
  subject: z.string().min(1),
  email: z.string(),
  tokens: Tokens.extend({ expiresAt: z.number() }).optional(),
});
const Vault = z.object({ hostId: z.string(), accounts: z.array(Registration) });
type Registration = z.infer<typeof Registration>;
export interface CredentialCipher {
  available(): boolean;
  encrypt(text: string): Buffer;
  decrypt(value: Buffer): string;
}
export async function verifyIdentity(
  token: string,
  clientId: string,
  nonce: string,
) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid ChatGPT identity token");
  const header = z
    .object({ alg: z.literal("RS256"), kid: z.string() })
    .parse(JSON.parse(Buffer.from(parts[0], "base64url").toString()));
  const response = await fetch(`${issuer}/.well-known/jwks.json`, {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Cannot validate ChatGPT identity");
  const keys = z
    .object({
      keys: z.array(
        z
          .object({
            kty: z.literal("RSA"),
            kid: z.string(),
            n: z.string(),
            e: z.string(),
          })
          .passthrough(),
      ),
    })
    .parse(await response.json());
  const key = keys.keys.find((k) => k.kid === header.kid);
  if (
    !key ||
    !verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key, format: "jwk" }),
      Buffer.from(parts[2], "base64url"),
    )
  )
    throw new Error("Invalid ChatGPT identity signature");
  const claims = z
    .object({
      iss: z.literal(issuer),
      aud: z.union([z.string(), z.array(z.string())]),
      exp: z.number(),
      sub: z.string().min(1),
      nonce: z.string(),
      azp: z.string().optional(),
      email: z.string().optional(),
      nbf: z.number().optional(),
    })
    .parse(JSON.parse(Buffer.from(parts[1], "base64url").toString()));
  if (
    !(Array.isArray(claims.aud)
      ? claims.aud.includes(clientId)
      : claims.aud === clientId) ||
    (claims.azp !== undefined && claims.azp !== clientId) ||
    (Array.isArray(claims.aud) &&
      claims.aud.length > 1 &&
      claims.azp !== clientId) ||
    claims.exp <= Date.now() / 1000 ||
    (claims.nbf !== undefined && claims.nbf > Date.now() / 1000) ||
    claims.nonce !== nonce
  )
    throw new Error("ChatGPT identity validation failed");
  return { subject: claims.sub, email: claims.email || "ChatGPT account" };
}
export class ChatGPTAuth {
  private data?: z.infer<typeof Vault>;
  private secureStorageAvailable = false;
  private cancelAttempt?: () => void;
  private refreshing = new Map<string, Promise<string>>();
  constructor(
    private filename: string,
    private cipher: CredentialCipher,
    private openBrowser: (url: string) => Promise<void>,
    private validateIdentity = verifyIdentity,
  ) {}
  private storageAvailable() {
    // A successful check applies to this process; a failure may be retried.
    return (this.secureStorageAvailable ||= this.cipher.available());
  }
  private vault() {
    if (this.data) return this.data;
    if (!this.storageAvailable())
      throw new Error(
        "Secure credential storage is unavailable on this computer",
      );
    if (!this.data) {
      try {
        const existing = existsSync(this.filename);
        this.data = existing
          ? Vault.parse(
              JSON.parse(this.cipher.decrypt(readFileSync(this.filename))),
            )
          : { hostId: `urn:uuid:${randomUUID()}`, accounts: [] };
        if (!existing) this.save();
      } catch {
        throw new Error(
          "Could not open protected ChatGPT credentials. Check the operating system credential store.",
        );
      }
    }
    return this.data;
  }
  private save() {
    mkdirSync(path.dirname(this.filename), { recursive: true });
    const temp = `${this.filename}.${randomUUID()}.tmp`;
    writeFileSync(temp, this.cipher.encrypt(JSON.stringify(this.data)), {
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temp, this.filename);
    chmodSync(this.filename, 0o600);
  }
  accounts(): ChatGPTAccount[] {
    // No credentials means no reason to access Keychain just to list accounts.
    if (!this.data && !existsSync(this.filename)) return [];
    if (!this.data && !this.storageAvailable()) return [];
    return this.vault().accounts.map((a) => ({
      id: a.clientId,
      label: `${a.email} · ${a.clientId.slice(-8)}`,
      connected: Boolean(a.tokens),
      planEnabled: Boolean(a.tokens?.scope.split(" ").includes(permission)),
    }));
  }
  cancel() {
    this.cancelAttempt?.();
  }
  async signIn(accountId?: string): Promise<ChatGPTAccount[]> {
    if (this.cancelAttempt)
      throw new Error("A ChatGPT sign-in is already in progress");
    const vault = this.vault();
    const previous = accountId
      ? vault.accounts.find((a) => a.clientId === accountId)
      : undefined;
    if (accountId && !previous) throw new Error("Unknown ChatGPT account");
    const state = randomBytes(32).toString("base64url"),
      nonce = randomBytes(32).toString("base64url"),
      verifier = randomBytes(32).toString("base64url");
    const server = createServer();
    let finish: (error?: Error) => void = () => {};
    const completed = new Promise<void>((resolve, reject) => {
      finish = (error) => {
        error ? reject(error) : resolve();
      };
    });
    // Handle early rejection while the system browser is still opening.
    void completed.catch(() => {});
    // Install cancellation before awaiting listen/openBrowser; always await this promise.
    let settled = false;
    const end = (error?: Error) => {
      if (settled) return;
      settled = true;
      finish(error);
    };
    this.cancelAttempt = () => end(new Error("ChatGPT sign-in cancelled"));
    const timer = setTimeout(
      () => end(new Error("ChatGPT sign-in timed out. Try again.")),
      300000,
    );
    let handling = false;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Cannot start sign-in callback");
      const redirect = `http://127.0.0.1:${address.port}/auth/callback`;
      server.on("request", async (req, res) => {
        const url = new URL(req.url || "/", redirect);
        if (req.method !== "GET" || url.pathname !== "/auth/callback") {
          res.writeHead(404).end();
          return;
        }
        if (
          url.searchParams.getAll("state").length !== 1 ||
          url.searchParams.get("state") !== state ||
          handling ||
          settled
        ) {
          res.writeHead(400).end("Invalid sign-in callback");
          return;
        }
        handling = true;
        try {
          if (url.searchParams.has("error"))
            throw new Error("ChatGPT sign-in was declined. You can try again.");
          const supplied = url.searchParams.get("client_id");
          const clientId = previous?.clientId || supplied;
          if (
            !clientId ||
            clientId === "dynamic_agent_client" ||
            (previous && supplied && supplied !== previous.clientId)
          )
            throw new Error("ChatGPT registration did not match this account");
          const code = url.searchParams.get("code");
          if (!code)
            throw new Error("ChatGPT sign-in returned no authorisation code");
          const tokens = await this.exchange({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            code_verifier: verifier,
            redirect_uri: redirect,
            resource,
          });
          const identity = await this.validateIdentity(
            tokens.id_token,
            clientId,
            nonce,
          );
          if (previous && previous.subject !== identity.subject)
            throw new Error("ChatGPT sign-in returned a different account");
          if (settled) throw new Error("ChatGPT sign-in cancelled");
          const registration: Registration = {
            clientId,
            ...identity,
            tokens: {
              ...tokens,
              expiresAt: Date.now() + tokens.expires_in * 1000,
            },
          };
          const existing = vault.accounts.findIndex(
            (a) => a.clientId === clientId,
          );
          if (
            existing >= 0 &&
            vault.accounts[existing].subject !== identity.subject
          )
            throw new Error("ChatGPT account identity mismatch");
          if (existing >= 0) vault.accounts.splice(existing, 1);
          vault.accounts.push(registration);
          this.save();
          res
            .writeHead(200, {
              "Content-Type": "text/plain",
              "Cache-Control": "no-store",
            })
            .end("ChatGPT connected. Return to Noteboard.");
          end();
        } catch {
          res
            .writeHead(400)
            .end(
              "Sign-in could not complete. Return to Noteboard and try again.",
            );
          end(
            new Error(
              "ChatGPT sign-in could not complete. Check consent and try again.",
            ),
          );
        }
      });
      const url = new URL(`${issuer}/api/accounts/authorize`);
      url.search = new URLSearchParams({
        client_id: previous?.clientId || "dynamic_agent_client",
        ext_agent_host_id: vault.hostId,
        response_type: "code",
        redirect_uri: redirect,
        scope:
          "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
        resource,
        state,
        nonce,
        code_challenge_method: "S256",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        ...(previous ? {} : { agent_name_hint: "Noteboard" }),
        ...(previous?.tokens
          ? { id_token_hint: previous.tokens.id_token }
          : {}),
      }).toString();
      if (!settled) await this.openBrowser(url.toString());
    } catch (error) {
      end(
        error instanceof Error
          ? error
          : new Error("Cannot open ChatGPT sign-in"),
      );
    }
    try {
      await completed;
      return this.accounts();
    } finally {
      clearTimeout(timer);
      server.closeAllConnections();
      server.close();
      this.cancelAttempt = undefined;
    }
  }
  private async exchange(fields: Record<string, string>) {
    const response = await fetch(`${issuer}/api/accounts/oauth/token`, {
      method: "POST",
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const code =
        typeof body.error === "string" ? body.error : body.error?.code;
      if (
        [
          "invalid_grant",
          "invalid_refresh_token",
          "token_expired",
          "refresh_token_expired",
          "refresh_token_invalidated",
          "refresh_token_reused",
        ].includes(code)
      )
        throw new Error("ChatGPT session expired. Sign in again.");
      throw new Error(
        `ChatGPT authorisation failed (HTTP ${response.status}). Try again later.`,
      );
    }
    try {
      return Tokens.parse(await response.json());
    } catch {
      throw new Error(
        "ChatGPT returned an invalid credential response. Sign in again.",
      );
    }
  }
  async accessToken(accountId?: string): Promise<string> {
    const account = this.vault().accounts.find((a) => a.clientId === accountId);
    if (!account?.tokens)
      throw new Error("Continue with ChatGPT in provider settings first");
    if (!account.tokens.scope.split(" ").includes(permission))
      throw new Error(
        "ChatGPT plan use is not enabled. Sign in again and allow plan usage.",
      );
    if (account.tokens.expiresAt > Date.now() + 60000)
      return account.tokens.access_token;
    const existing = this.refreshing.get(account.clientId);
    if (existing) return existing;
    const previousTokens = account.tokens;
    const unchanged = () =>
      account.tokens === previousTokens &&
      this.vault().accounts.find(
        (value) => value.clientId === account.clientId,
      ) === account;
    const refresh = (async () => {
      try {
        const tokens = await this.exchange({
          grant_type: "refresh_token",
          client_id: account.clientId,
          refresh_token: account.tokens!.refresh_token,
          resource,
        });
        if (!unchanged())
          throw new Error("ChatGPT account changed during refresh");
        account.tokens = {
          ...tokens,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        };
        this.save();
        if (!tokens.scope.split(" ").includes(permission))
          throw new Error(
            "ChatGPT plan permission was removed. Sign in again.",
          );
        return tokens.access_token;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("session expired") &&
          unchanged()
        ) {
          delete account.tokens;
          this.save();
        }
        throw error;
      } finally {
        this.refreshing.delete(account.clientId);
      }
    })();
    this.refreshing.set(account.clientId, refresh);
    return refresh;
  }
  async signOut(accountId: string): Promise<{ revoked: boolean }> {
    if (this.cancelAttempt) throw new Error("Finish or cancel sign-in first");
    const account = this.vault().accounts.find((a) => a.clientId === accountId);
    if (!account) throw new Error("Unknown ChatGPT account");
    const tokens = account.tokens;
    delete account.tokens;
    this.save();
    if (!tokens) return { revoked: true };
    let revoked = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`${issuer}/api/accounts/oauth/revoke`, {
          method: "POST",
          body: new URLSearchParams({
            token: tokens.refresh_token,
            token_type_hint: "refresh_token",
            client_id: account.clientId,
          }),
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        });
        revoked = response.ok;
        if (revoked || response.status < 500) break;
      } catch {
        /* Local sign-out still succeeds; report unconfirmed revocation. */
      }
      if (!attempt) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return { revoked };
  }
}
