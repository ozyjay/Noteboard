import { describe, expect, it, vi } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ChatGPTAuth, CredentialStorageError } from "../electron/chatgpt-auth";
import { macCredentialCipher } from "../electron/macos-credentials";

const fixture = JSON.stringify({
  hostId: "urn:uuid:preserved-host",
  accounts: [
    {
      clientId: "preserved-client",
      subject: "preserved-subject",
      email: "test@example.com",
      tokens: {
        access_token: "synthetic-access",
        refresh_token: "synthetic-refresh",
        id_token: "synthetic-id",
        token_type: "Bearer",
        expires_in: 3600,
        expiresAt: Date.now() + 3600000,
        scope: "openid chatgpt.tokens.use.direct offline_access",
      },
    },
  ],
});
const legacy = Buffer.from("v10synthetic-legacy-ciphertext");
function keychain() {
  const key = randomBytes(32);
  return {
    available: vi.fn(() => true),
    unlock: vi.fn(() => Buffer.from(key)),
  };
}

describe("Touch ID protected credential storage", () => {
  it("encrypts authenticated envelopes, unlocks once and clears the cached key on disposal", () => {
    const native = keychain();
    const oldDecrypt = vi.fn(() => fixture);
    const cipher = macCredentialCipher(
      "/test/credentials.bin",
      () => native,
      oldDecrypt,
    );
    const first = cipher.encrypt(fixture);
    expect(first.toString()).not.toContain("synthetic-access");
    expect(cipher.decrypt(first)).toBe(fixture);
    expect(cipher.decrypt(cipher.encrypt(fixture))).toBe(fixture);
    expect(native.unlock).toHaveBeenCalledTimes(1);
    expect(native.unlock).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      true,
    );
    const cached = native.unlock.mock.results[0].value as Buffer;
    cipher.dispose?.();
    expect(cached).toEqual(Buffer.alloc(32));
    expect(cipher.decrypt(first)).toBe(fixture);
    expect(native.unlock).toHaveBeenLastCalledWith(expect.any(String), false);
    expect(native.unlock).toHaveBeenCalledTimes(2);
    expect(oldDecrypt).not.toHaveBeenCalled();
  });

  it("rejects tampering, unsupported formats and envelopes from another vault without legacy fallback", () => {
    const native = keychain();
    const oldDecrypt = vi.fn(() => fixture);
    const cipher = macCredentialCipher("/test/a", () => native, oldDecrypt);
    const encrypted = cipher.encrypt(fixture);
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] ^= 1;
    expect(() => cipher.decrypt(tampered)).toThrow();
    expect(() => cipher.decrypt(Buffer.from("NBKC\x02unsupported"))).toThrow(
      /Unrecognised/,
    );
    expect(() => cipher.decrypt(Buffer.from("NBKC\x01"))).toThrow(
      /Unrecognised/,
    );
    const other = macCredentialCipher("/test/b", () => native, oldDecrypt);
    expect(() => other.decrypt(encrypted)).toThrow();
    expect(oldDecrypt).not.toHaveBeenCalled();
  });

  it("refuses missing entitlements and never creates a missing key while decrypting", () => {
    const native = keychain();
    native.available.mockReturnValue(false);
    const cipher = macCredentialCipher(
      "/test/a",
      () => native,
      () => fixture,
    );
    expect(() => cipher.available()).toThrow(/provisioning profile/);
    expect(native.unlock).not.toHaveBeenCalled();
    native.available.mockReturnValue(true);
    const encrypted = cipher.encrypt(fixture);
    cipher.dispose?.();
    native.unlock.mockImplementation(() => {
      throw new Error("Credential key missing");
    });
    expect(() => cipher.decrypt(encrypted)).toThrow(/key missing/);
    expect(native.unlock).toHaveBeenLastCalledWith(expect.any(String), false);
  });

  it("migrates validated legacy credentials atomically, preserving registrations and reopening with the new key", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "noteboard-touchid-"));
    const filename = path.join(dir, "credentials.bin");
    const native = keychain();
    const oldDecrypt = vi.fn(() => fixture);
    try {
      writeFileSync(filename, legacy, { mode: 0o600 });
      const cipher = macCredentialCipher(filename, () => native, oldDecrypt);
      const auth = new ChatGPTAuth(filename, cipher, async () => {});
      const accounts = auth.accounts();
      expect(accounts).toMatchObject([
        { id: "preserved-client", connected: true },
      ]);
      expect(await auth.accessToken("preserved-client")).toBe(
        "synthetic-access",
      );
      const saved = readFileSync(filename);
      expect(saved.equals(legacy)).toBe(false);
      expect(JSON.parse(cipher.decrypt(saved))).toEqual(JSON.parse(fixture));
      expect(statSync(filename).mode & 0o777).toBe(0o600);
      expect(readdirSync(dir)).toEqual(["credentials.bin"]);
      expect(oldDecrypt).toHaveBeenCalledTimes(1);
      auth.dispose();
      const reopened = new ChatGPTAuth(
        filename,
        macCredentialCipher(filename, () => native, oldDecrypt),
        async () => {},
      );
      expect(reopened.accounts()).toEqual(accounts);
      expect(await reopened.accessToken("preserved-client")).toBe(
        "synthetic-access",
      );
      expect(readFileSync(filename)).toEqual(saved);
      expect(oldDecrypt).toHaveBeenCalledTimes(1);
      expect(native.unlock).toHaveBeenCalledTimes(2);
      reopened.dispose();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("leaves legacy credentials untouched after cancellation and retries rather than caching a failed migration", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "noteboard-touchid-"));
    const filename = path.join(dir, "credentials.bin");
    const native = keychain();
    const unlock = native.unlock.getMockImplementation()!;
    native.unlock.mockImplementationOnce(() => {
      throw new Error("Credential unlock was cancelled");
    });
    const oldDecrypt = vi.fn(() => fixture);
    try {
      writeFileSync(filename, legacy, { mode: 0o600 });
      const auth = new ChatGPTAuth(
        filename,
        macCredentialCipher(filename, () => native, oldDecrypt),
        async () => {},
      );
      expect(() => auth.accounts()).toThrow(CredentialStorageError);
      expect(readFileSync(filename)).toEqual(legacy);
      expect(readdirSync(dir)).toEqual(["credentials.bin"]);
      native.unlock.mockImplementation(unlock);
      expect(auth.accounts()).toMatchObject([{ connected: true }]);
      expect(oldDecrypt).toHaveBeenCalledTimes(2);
      expect(readFileSync(filename).equals(legacy)).toBe(false);
      auth.dispose();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates legacy records before creating a key or replacing the file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "noteboard-touchid-"));
    const filename = path.join(dir, "credentials.bin");
    const native = keychain();
    try {
      writeFileSync(filename, legacy, { mode: 0o600 });
      const auth = new ChatGPTAuth(
        filename,
        macCredentialCipher(
          filename,
          () => native,
          () => "{}",
        ),
        async () => {},
      );
      expect(() => auth.accounts()).toThrow(/Could not open/);
      expect(native.unlock).not.toHaveBeenCalled();
      expect(readFileSync(filename)).toEqual(legacy);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
