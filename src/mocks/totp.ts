/**
 * Mock uchun TOTP (RFC 6238, SHA-1, 6 raqam, 30 soniya) — backend `@app/common` `verifyTotp` bilan bir xil.
 * Toza JS (sinxron): brauzerdagi MSW, Node (e2e) va jsdom (Vitest) da bir xil ishlaydi; e2e testlar ham shu
 * funksiya bilan joriy kodni hisoblaydi.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_STEP_SECONDS = 30;

export function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes);
}

function rotl(value: number, shift: number) {
  return (value << shift) | (value >>> (32 - shift));
}

function sha1(message: Uint8Array): Uint8Array {
  const length = message.length;
  const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6);
  padded.set(message);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, length * 8);
  view.setUint32(padded.length - 8, Math.floor((length * 8) / 2 ** 32));
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(80);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 80; index += 1) words[index] = rotl(words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16], 1);
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < 80; index += 1) {
      const [f, k] = index < 20 ? [(b & c) | (~b & d), 0x5a827999]
        : index < 40 ? [b ^ c ^ d, 0x6ed9eba1]
          : index < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
            : [b ^ c ^ d, 0xca62c1d6];
      const temp = (rotl(a, 5) + f + e + k + words[index]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30) >>> 0;
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((value, index) => outView.setUint32(index * 4, value));
  return out;
}

function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  const block = new Uint8Array(64);
  block.set(key.length > 64 ? sha1(key) : key);
  const inner = new Uint8Array(64 + message.length);
  const outer = new Uint8Array(64 + 20);
  for (let index = 0; index < 64; index += 1) {
    inner[index] = block[index] ^ 0x36;
    outer[index] = block[index] ^ 0x5c;
  }
  inner.set(message, 64);
  outer.set(sha1(inner), 64);
  return sha1(outer);
}

/** Berilgan oraliq (counter) uchun 6 raqamli kod. */
export function totpAt(secret: string, counter: number): string {
  const message = new Uint8Array(8);
  const view = new DataView(message.buffer);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const digest = hmacSha1(base32Decode(secret), message);
  const offset = digest[19] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

export const totpCounter = (now = Date.now()) => Math.floor(now / 1000 / TOTP_STEP_SECONDS);

/** Joriy kod (e2e va dev demo uchun). */
export const currentTotp = (secret: string, now = Date.now()) => totpAt(secret, totpCounter(now));

/** Kod to'g'ri bo'lsa — oraliq raqami (±1 oraliq, soat farqi uchun), aks holda `null`. */
export function verifyTotp(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const counter = totpCounter(now);
  for (const candidate of [counter, counter - 1, counter + 1]) {
    if (totpAt(secret, candidate) === code) return candidate;
  }
  return null;
}
