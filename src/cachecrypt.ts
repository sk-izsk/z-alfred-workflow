import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * On-disk format of the item-name cache: `BWC1` + 12-byte nonce + 16-byte GCM tag + ciphertext.
 * AES-256-GCM, so a wrong key or any change to the file is detected rather than read as garbage.
 */
const MAGIC = Buffer.from("BWC1");
const NONCE = 12;
const TAG = 16;

export const sealCache = (plaintext: string, key: Buffer): Buffer => {
  const nonce = randomBytes(NONCE);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([MAGIC, nonce, cipher.getAuthTag(), body]);
};

/** The plaintext, or undefined for a wrong key, a modified or truncated file, or something else entirely. */
export const openCache = (blob: Buffer, key: Buffer): string | undefined => {
  if (blob.length < MAGIC.length + NONCE + TAG || !blob.subarray(0, MAGIC.length).equals(MAGIC))
    return undefined;
  try {
    const nonce = blob.subarray(MAGIC.length, MAGIC.length + NONCE);
    const tag = blob.subarray(MAGIC.length + NONCE, MAGIC.length + NONCE + TAG);
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(blob.subarray(MAGIC.length + NONCE + TAG)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return undefined;
  }
};

/** Caches written by earlier versions were plain JSON; they start with `{`. */
export const isLegacyPlainCache = (blob: Buffer): boolean => blob[0] === 0x7b;
