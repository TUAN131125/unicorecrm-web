# Form and Presentation Contracts

## Shared modal sizing

The shared `Modal` supports exactly:

```text
sm
md
lg
```

Canonical widths:

```text
sm = 520 px
md = 840 px
lg = 1200 px
```

Sizing is based on actual form complexity:

```text
1–4 controls   → sm
5–20 controls  → md
21+ controls   → lg
```

Dense nested Lead forms and Product Picker use `lg` even when a raw native-control count understates their visual complexity.

Consumers must not add per-modal `max-w-*` overrides to bypass the shared contract.

## Modal variants

The shared modal supports:

```text
standard
form
auto
```

`auto` may detect native form content. Audited create/edit/configuration surfaces should use the form contract where appropriate.

The shared form shell owns:

- header placement;
- close control;
- content scrolling;
- form-surface background;
- optional persistent footer.

Nested forms should not recreate competing scroll containers or duplicated outer padding.

## Form surface styling

Scoped classes:

```text
.crm-form-surface
.crm-form-page
```

They standardize:

- form typography;
- white controls;
- consistent borders;
- violet focus ring;
- minimum control height;
- label hierarchy;
- button/control radius;
- soft form background.

The styles are scoped so form work does not become an uncontrolled global redesign.

## Full-page forms

Order, Return and Support use the shared page-form archetype.

Quote Builder uses the same form visual language but keeps a wider transaction canvas for line items, pricing and document editing.

## Product Picker

Product Picker is a large two-pane composition:

- catalog/search side;
- current selection side;
- persistent footer;
- explicit selected-state feedback.

Open-cycle selection state must initialize from the current input without background refreshes resetting active user edits.

## Source-prefill protection

Forms that initialize from route/source records must key initialization to source identity rather than a lifetime boolean.

Required behavior:

- same-source repository refresh does not wipe active edits;
- a genuinely different target can initialize correctly;
- delayed reference data does not repeatedly overwrite user-entered values.

This contract applies to important Quote, Order and Support flows and to other audited create/edit surfaces with source-prefill behavior.

## Native form safety

Every button inside a native `<form>` must have an explicit `type` unless it intentionally submits.

Every controlled native input/select/textarea must provide one of:

- `onChange`;
- `readOnly`;
- `disabled`.

This prevents accidental parent-form submission and unintentionally locked fields.

## List archetype

List surfaces should use the shared list contracts for:

- page title and count;
- contextual description;
- search and filters;
- loading/empty/error state;
- permission-aware actions;
- stable table/card behavior where the domain benefits from both.

Organization List currently uses table/card modes and exposes the primary representative in each representation.

## Detail archetype

Detail surfaces should use explicit sections/tabs rather than uncontrolled stacked pages.

Organization Detail currently includes:

```text
Overview
Representatives
Deals
Quotes
Orders
Work
Support
```

Commercial tabs resolve records by the Organization buyer reference. Person identity stays with Contact.

## Regression gate

Run:

```bash
npm run quality:gate -- --gate quality.form-runtime-sizing
```

The gate checks the shared size tiers and widths, complexity sizing, approved form surfaces, Product Picker composition, prefill guards, full-page form archetypes and native form-control safety.
