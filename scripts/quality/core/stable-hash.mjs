import crypto from "node:crypto";

export function stableHash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function stableShardIndex(shardKey, shardTotal) {
  if (!Number.isInteger(shardTotal) || shardTotal < 1) throw new Error(`Invalid shard total: ${shardTotal}`);
  const prefix = stableHash(shardKey).slice(0, 12);
  return Number.parseInt(prefix, 16) % shardTotal;
}
