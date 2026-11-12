// 2026/11/12 - Arlen - 備註欄位應用層加密（FSD §6.3）：AES-256-GCM
// 密文格式：v1:{iv}:{ciphertext}:{authTag}，三段皆 Base64
import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const KEY_VERSION = "v1";
let key: Buffer | null = null;

function getKey(): Buffer {
  if (key) return key;
  const raw = process.env.NOTE_ENC_KEY;
  if (!raw) throw new Error("未設定 NOTE_ENC_KEY");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("NOTE_ENC_KEY 必須是 32 bytes 的 Base64");
  key = buf;
  return key;
}

/** 空字串回 null，不存密文 */
export function encryptNote(plain: string): string | null {
  const text = plain.trim();
  if (!text) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [KEY_VERSION, iv.toString("base64"), enc.toString("base64"), cipher.getAuthTag().toString("base64")].join(":");
}

export function decryptNote(stored: string | null): string {
  if (!stored) return "";
  const [ver, iv, data, tag] = stored.split(":");
  if (ver !== KEY_VERSION || !iv || !data || !tag) throw new Error("備註密文格式不正確");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/** 通行碼原文：am_ + 32 bytes base64url */
export function newTokenPlain(): string {
  return `am_${randomBytes(32).toString("base64url")}`;
}

/** 通行碼指紋：SHA-256 hex */
export function hashToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}
