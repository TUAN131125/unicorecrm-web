/** Deterministic SHA-256 implementation used for tamper-evident local evidence. */
export function sha256(input: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const maxWord = 2 ** 32;
  const words: number[] = [];
  const ascii = unescape(encodeURIComponent(input));
  const length = ascii.length;
  const hash: number[] = [];
  const constants: number[] = [];
  const composite: Record<number, boolean> = {};
  let primeCounter = 0;

  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (composite[candidate]) continue;
    for (let multiple = candidate * candidate; multiple < 313; multiple += candidate) composite[multiple] = true;
    if (primeCounter < 8) hash[primeCounter] = (Math.sqrt(candidate) * maxWord) | 0;
    constants[primeCounter] = (Math.cbrt(candidate) * maxWord) | 0;
    primeCounter += 1;
  }

  let padded = `${ascii}\x80`;
  while ((padded.length % 64) !== 56) padded += "\x00";
  for (let index = 0; index < padded.length; index += 1) words[index >> 2] = (words[index >> 2] || 0) | padded.charCodeAt(index) << ((3 - index) % 4) * 8;
  words.push((length / maxWord) | 0, length << 3);

  for (let block = 0; block < words.length; block += 16) {
    const schedule = words.slice(block, block + 16);
    const initial = hash.slice(0, 8);
    let working = hash.slice(0, 8);
    for (let index = 0; index < 64; index += 1) {
      const w15 = schedule[index - 15];
      const w2 = schedule[index - 2];
      const sigma0 = index < 16 ? 0 : rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const sigma1 = index < 16 ? 0 : rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      schedule[index] = index < 16 ? schedule[index] : (((schedule[index - 16] + sigma0) | 0) + ((schedule[index - 7] + sigma1) | 0)) | 0;
      const [a, b, c, d, e, f, g, h] = working;
      const sum1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (((((h + sum1) | 0) + choice) | 0) + constants[index] + schedule[index]) | 0;
      const sum0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) | 0;
      working = [(temp1 + temp2) | 0, a, b, c, (d + temp1) | 0, e, f, g];
    }
    hash.splice(0, 8, ...working.map((value, index) => (value + initial[index]) | 0));
  }
  return hash.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

function isJsonOmitted(value: unknown): boolean {
  return value === undefined || typeof value === "function" || typeof value === "symbol";
}

/**
 * Deterministic JSON serialization that preserves JSON.stringify semantics.
 * Object properties with undefined/function/symbol values are omitted, while
 * the same values inside arrays become null. This keeps a persisted record's
 * hash stable after the browser JSON storage round-trip.
 */
export function canonicalStringify(value: unknown): string {
  const normalized = value !== null && typeof value === "object" && "toJSON" in value && typeof (value as { toJSON?: unknown }).toJSON === "function"
    ? (value as { toJSON: () => unknown }).toJSON()
    : value;
  if (normalized === null) return "null";
  if (isJsonOmitted(normalized)) return "null";
  if (typeof normalized === "number" && !Number.isFinite(normalized)) return "null";
  if (typeof normalized !== "object") return JSON.stringify(normalized);
  if (Array.isArray(normalized)) {
    return `[${normalized.map((item) => isJsonOmitted(item) ? "null" : canonicalStringify(item)).join(",")}]`;
  }
  const object = normalized as Record<string, unknown>;
  const keys = Object.keys(object).filter((key) => !isJsonOmitted(object[key])).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(object[key])}`).join(",")}}`;
}
