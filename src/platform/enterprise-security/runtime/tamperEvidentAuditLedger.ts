import { BrowserStorageAdapter, type StoragePort } from "@/platform/persistence";
import type { AuditLedgerVerification, TamperEvidentAuditRecord } from "../domain/enterpriseSecurity.types";
import { canonicalStringify, sha256 } from "./stableHash";
import { sanitizeSensitiveValue } from "./secretProtection";

const memory = new Map<string, TamperEvidentAuditRecord[]>();
const storage = new BrowserStorageAdapter();
const keyFor = (scopeId: string) => `unicore_tamper_evident_audit_v1:${scopeId}`;

function clone(records: TamperEvidentAuditRecord[]): TamperEvidentAuditRecord[] {
  return structuredClone(records);
}

function load(scopeId: string, port: StoragePort = storage): TamperEvidentAuditRecord[] {
  const persisted = port.get<TamperEvidentAuditRecord[]>(keyFor(scopeId));
  if (Array.isArray(persisted)) {
    memory.set(scopeId, clone(persisted));
    return clone(persisted);
  }
  return clone(memory.get(scopeId) ?? []);
}

function save(scopeId: string, records: TamperEvidentAuditRecord[], port: StoragePort = storage): void {
  memory.set(scopeId, clone(records));
  port.set(keyFor(scopeId), records);
}

function payloadFor(record: Omit<TamperEvidentAuditRecord, "payloadHash" | "recordHash">): string {
  return canonicalStringify(record);
}

export function verifyTamperEvidentAuditLedger(scopeId: string, port: StoragePort = storage): AuditLedgerVerification {
  const records = load(scopeId, port);
  let previousHash = "GENESIS";
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.sequence !== index + 1 || record.previousHash !== previousHash) {
      return { valid: false, records: records.length, headHash: previousHash, firstInvalidSequence: index + 1, reason: "Sequence or previous hash mismatch." };
    }
    const base = { ...record };
    delete (base as Partial<TamperEvidentAuditRecord>).payloadHash;
    delete (base as Partial<TamperEvidentAuditRecord>).recordHash;
    const expectedPayloadHash = sha256(payloadFor(base as Omit<TamperEvidentAuditRecord, "payloadHash" | "recordHash">));
    const expectedRecordHash = sha256(`${expectedPayloadHash}:${record.previousHash}`);
    if (record.payloadHash !== expectedPayloadHash || record.recordHash !== expectedRecordHash) {
      return { valid: false, records: records.length, headHash: previousHash, firstInvalidSequence: index + 1, reason: "Record hash mismatch." };
    }
    previousHash = record.recordHash;
  }
  return { valid: true, records: records.length, headHash: previousHash };
}

export function appendTamperEvidentAuditRecord(
  input: Omit<TamperEvidentAuditRecord, "eventId" | "sequence" | "occurredAt" | "previousHash" | "payloadHash" | "recordHash"> & {
    eventId?: string;
    occurredAt?: string;
  },
  port: StoragePort = storage,
): TamperEvidentAuditRecord {
  const verification = verifyTamperEvidentAuditLedger(input.scopeId, port);
  if (!verification.valid) throw new Error(`Audit ledger integrity failure at sequence ${verification.firstInvalidSequence}.`);
  const records = load(input.scopeId, port);
  const base: Omit<TamperEvidentAuditRecord, "payloadHash" | "recordHash"> = {
    eventId: input.eventId ?? `audit_${Date.now()}_${records.length + 1}`,
    scopeId: input.scopeId,
    sequence: records.length + 1,
    category: input.category,
    action: input.action,
    actorId: input.actorId,
    subjectId: input.subjectId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    metadata: input.metadata ? sanitizeSensitiveValue(input.metadata) as Record<string, unknown> : undefined,
    previousHash: records.at(-1)?.recordHash ?? "GENESIS",
  };
  const payloadHash = sha256(payloadFor(base));
  const record: TamperEvidentAuditRecord = { ...base, payloadHash, recordHash: sha256(`${payloadHash}:${base.previousHash}`) };
  save(input.scopeId, [...records, record], port);
  return structuredClone(record);
}

export function getTamperEvidentAuditSnapshot(scopeId: string, port: StoragePort = storage): TamperEvidentAuditRecord[] {
  return load(scopeId, port);
}
