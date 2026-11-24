import { createHmac } from "node:crypto";

/** RFC 6238 TOTP with Bitwarden's formats: raw base32, otpauth:// URIs and steam:// keys. */
export type TotpConfig = {
  secret: Buffer;
  period: number;
  digits: number;
  algorithm: string;
  steam: boolean;
};

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEAM_CHARS = "23456789BCDFGHJKMNPQRTVWXY";

export const base32Decode = (input: string): Buffer => {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = "";
  for (const char of clean) {
    const value = BASE32.indexOf(char);
    if (value < 0) throw new Error("Invalid authenticator key");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  // An empty key would still "work" with HMAC and give a meaningless code.
  if (!bytes.length) throw new Error("Invalid authenticator key");
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
};

export const parseTotp = (raw: string): TotpConfig => {
  const value = raw.trim();
  if (value.toLowerCase().startsWith("steam://")) {
    return { secret: base32Decode(value.slice(8)), period: 30, digits: 5, algorithm: "sha1", steam: true };
  }
  if (value.toLowerCase().startsWith("otpauth://")) {
    const params = new URL(value).searchParams;
    return {
      secret: base32Decode(params.get("secret") ?? ""),
      period: Number(params.get("period")) || 30,
      digits: Number(params.get("digits")) || 6,
      algorithm: (params.get("algorithm") ?? "sha1").toLowerCase(),
      steam: false,
    };
  }
  return { secret: base32Decode(value), period: 30, digits: 6, algorithm: "sha1", steam: false };
};

const hotp = (config: TotpConfig, counter: number): string => {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac(config.algorithm, config.secret).update(message).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  if (!config.steam) return String(binary % 10 ** config.digits).padStart(config.digits, "0");
  let code = "";
  for (let i = 0, rest = binary; i < config.digits; i++, rest = Math.floor(rest / STEAM_CHARS.length)) {
    code += STEAM_CHARS[rest % STEAM_CHARS.length];
  }
  return code;
};

export const totpCode = (raw: string, now = Date.now()): string => {
  const config = parseTotp(raw);
  return hotp(config, Math.floor(now / 1000 / config.period));
};

/** Seconds until the current code changes. */
export const totpRemaining = (raw: string, now = Date.now()): number => {
  const { period } = parseTotp(raw);
  return period - (Math.floor(now / 1000) % period);
};

export const totpPeriod = (raw: string): number => parseTotp(raw).period;

/** "123456" → "123 456" for reading; copying always uses the plain code. */
export const formatCode = (code: string): string =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
