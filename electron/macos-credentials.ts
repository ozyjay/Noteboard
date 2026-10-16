import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { CredentialStorageError, type CredentialCipher } from "./chatgpt-auth";

export interface MacKeychain {
  available(): boolean;
  unlock(vaultId: string, create: boolean): Buffer;
}

const magic = Buffer.from("NBKC\x01");
const legacyMagic = Buffer.from("v10");

export function macCredentialCipher(
  filename: string,
  native: () => MacKeychain,
  legacyDecrypt: (value: Buffer) => string,
): CredentialCipher {
  const vaultId = createHash("sha256").update(filename).digest("hex");
  const aad = Buffer.from(`Noteboard credentials v1:${vaultId}`);
  let key: Buffer | undefined;
  const unlock = (create: boolean) => {
    if (!key) {
      try {
        const value = native().unlock(vaultId, create);
        if (!Buffer.isBuffer(value) || value.length !== 32)
          throw new Error("Invalid credential key");
        key = value;
      } catch (error) {
        throw new CredentialStorageError(
          error instanceof Error
            ? error.message
            : "Could not unlock Noteboard credentials",
        );
      }
    }
    return key;
  };
  return {
    available() {
      if (!native().available())
        throw new CredentialStorageError(
          "Touch ID credential storage requires a signed Noteboard app with a matching provisioning profile and Keychain entitlements. See docs/development.md.",
        );
      return true;
    },
    needsMigration: (value) => value.subarray(0, 3).equals(legacyMagic),
    encrypt(text) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", unlock(true), iv);
      cipher.setAAD(aad);
      return Buffer.concat([
        magic,
        iv,
        cipher.update(text, "utf8"),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
    },
    decrypt(value) {
      if (value.subarray(0, 3).equals(legacyMagic)) return legacyDecrypt(value);
      if (
        value.length < magic.length + 12 + 16 ||
        !value.subarray(0, magic.length).equals(magic)
      )
        throw new CredentialStorageError(
          "Unrecognised Noteboard credential format. Existing credentials have not been replaced.",
        );
      const decipher = createDecipheriv(
        "aes-256-gcm",
        unlock(false),
        value.subarray(magic.length, magic.length + 12),
      );
      decipher.setAAD(aad);
      decipher.setAuthTag(value.subarray(-16));
      return Buffer.concat([
        decipher.update(value.subarray(magic.length + 12, -16)),
        decipher.final(),
      ]).toString("utf8");
    },
    dispose() {
      key?.fill(0);
      key = undefined;
    },
  };
}
