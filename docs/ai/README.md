# docs/ai — Claude project memory

`CLAUDE.md` at the repository root is loaded every session and imports the four
core memory files in this directory:

```text
docs/ai/PROJECT_STATE.md            current truth: HEAD, working tree, phase position, gates
docs/ai/ARCHITECTURE_INVARIANTS.md  stable MA-01..MA-09 mutation-authority rules
docs/ai/ROADMAP.md                  closed M0–M12 phase list and status
docs/ai/DEFERRED_FINDINGS.md        unresolved findings assigned to existing phases
```

Rules for maintaining this memory:

- These files are summaries, not archives. Keep them loadable every session.
- Do not paste full command inventories, full diffs, test logs, long source
  excerpts, negative-control logs, or full phase reports into them.
- Update `PROJECT_STATE.md` when a phase completes; update `ROADMAP.md` status
  in the same change.
- New unresolved issues go to `DEFERRED_FINDINGS.md` with a target phase from
  the existing M0–M12 list.
- Detailed phase reports, if ever produced, belong under `docs/ai/reports/`.
  `CLAUDE.md` must NOT import that directory.

`docs/ai/SKILLS.md` is pre-existing Order-to-Cash domain guidance referenced by
`AGENTS.md`; it is not part of this memory system and is not auto-imported.
