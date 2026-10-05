import assert from "node:assert/strict";
import { registerUnsavedWork, discardDirtyUnsavedWork, saveDirtyUnsavedWork } from "@/platform/unsaved-work";
for (const reverse of [false, true]) {
  let a = 0; let b = 0; let allowB = false;
  const entries = [
    { id: "atomic-A", title: "A", isDirty: true, canDiscard: () => true, discard: () => { a++; }, save: async () => true },
    { id: "atomic-B", title: "B", isDirty: true, canDiscard: () => allowB, discard: () => { b++; }, save: async () => true },
  ];
  const unregister = (reverse ? entries.reverse() : entries).map(registerUnsavedWork);
  try {
    assert.equal(discardDirtyUnsavedWork(), false); assert.equal(a, 0); assert.equal(b, 0);
    allowB = true;
    assert.equal(discardDirtyUnsavedWork(), true); assert.equal(a, 1); assert.equal(b, 1);
  } finally { unregister.forEach(cleanup => cleanup()); }
}
let legacyDiscards = 0;
const cleanup = registerUnsavedWork({ id: "legacy", title: "Legacy", isDirty: true, discard: () => { legacyDiscards++; }, save: async () => true });
try { assert.equal(discardDirtyUnsavedWork(), true); assert.equal(legacyDiscards, 1); } finally { cleanup(); }
const saved: string[] = [];
const cleanups = [true, false, true].map((result, index) => registerUnsavedWork({ id: `save-${index}`, title: "Save", isDirty: true, discard() {}, save: async () => { saved.push(String(index)); return result; } }));
try { assert.equal(await saveDirtyUnsavedWork(), false); assert.deepEqual(saved, ["0", "1"]); } finally { cleanups.forEach(fn => fn()); }
console.log("Atomic discard PASS: zero destructive calls on veto, both insertion orders, all allowed once, legacy void compatibility, sequential Save unchanged.");
