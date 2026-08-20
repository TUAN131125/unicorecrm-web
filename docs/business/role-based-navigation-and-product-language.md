# Role-based Navigation and Product Language

## Purpose

The CRM shell should reduce noise without weakening access control. Navigation is a work-focus projection over the effective capability model, while direct routes and write actions remain protected by capability guards.

Product language must use one Vietnamese/English glossary and must not expose member IDs, owner IDs, internal enum values, or mixed-language labels on normal user surfaces.

## Navigation profiles

Navigation profiles are resolved from the active role templates in `src/app/navigation/roleBasedNavigation.ts`.

The current profiles are:

- Workspace administration;
- Sales and Sales management;
- Finance and receivables;
- Order operations;
- Customer Success and Support;
- Viewer;
- capability-based custom or combined roles.

A profile controls which readable modules are promoted in the sidebar. It does not grant capabilities and it does not change data scope.

Custom roles without template provenance retain capability-based navigation so an administrator does not lose access merely because a role is not derived from a standard template.

## Default role templates

The access-control catalog includes dedicated Finance and Operations templates.

Finance owns:

- payment recording;
- reconciliation;
- refunds;
- financial reporting.

Finance receives read-only context for Orders and Shipping by default.

Operations owns:

- confirmed-order operations;
- shipping creation and recovery;
- return processing;
- operational tasks.

Operations receives read-only payment context by default.

Access-control schema migration adds the new templates without automatically assigning them and without expanding custom roles.

## Cross-domain read-only contract

A user may need related status without owning the update action. `PermissionRouteGuard` therefore distinguishes:

```text
permission denied
read-only
read-write
```

When a readable module has no effective write capability, the route displays a read-only banner that explains:

- the user can review status;
- update actions remain unavailable;
- the responsible business area owns changes.

Direct write routes require their action capability. Read permission alone cannot open create, edit, qualification, or conversion routes.

Examples:

- Finance can review an Order but cannot edit it by default.
- Operations can review Payment status but cannot record a payment.
- Customer Success can review Order, Payment, and Shipping status while owning Support and care actions.
- Sales can follow related post-sale evidence through linked screens without having those modules promoted in daily navigation.

The banner is an experience contract, not a substitute for command/API authorization.

## Canonical terminology

`src/i18n/productGlossary.ts` owns the product-level terminology used across navigation, status presentation, guidance, and high-value workflow surfaces.

Canonical Vietnamese terms include:

| English | Vietnamese |
|---|---|
| Lead | Khách hàng tiềm năng |
| Contact | Người liên hệ |
| Organization | Tổ chức |
| Customer profile | Hồ sơ khách hàng |
| Deal | Cơ hội |
| Quote | Báo giá |
| Order | Đơn hàng |
| Payment | Thanh toán |
| Shipping | Vận đơn |
| Return / Exchange | Đổi / Trả hàng |
| Support ticket | Phiếu hỗ trợ |
| Task | Công việc |
| Owner | Người phụ trách |
| Next step | Hành động tiếp theo |

Business enum values must be mapped to friendly labels. Unknown codes may be humanized for diagnostics, but underscores and raw internal identifiers must not be displayed as normal copy.

## User-facing identity resolution

Member and actor references must pass through the workspace member directory.

If a reference cannot be resolved, the product shows a localized unresolved label or a neutral dash. It must not fall back to values such as `u3`, `member_123`, or account IDs.

Technical identifiers may appear only in explicitly diagnostic/admin contexts with a clear label.

## Guidance contract

Guidance includes:

- the active role-focused navigation profile;
- cross-team read-only behavior;
- capability-controlled actions;
- canonical labels.

Stable selectors:

```text
shell.navigation.profile
access.read-only.notice
```

## Verification

The following commands are mandatory:

```bash
npm run quality:gate -- --gate quality.role-based-navigation
npm run quality:gate -- --gate quality.read-only-cross-domain
npm run quality:gate -- --gate quality.product-glossary
npm run quality:gate -- --gate quality.user-facing-identifiers
npm run quality:gate -- --gate quality.bilingual-ui
npm run quality:gate -- --gate quality.workspace-navigation-language
npm run quality:gate -- --gate quality.access-control-contracts
```

## Production limits

Frontend role-focused navigation and route guards do not prove server authorization. Final acceptance still requires:

- capability enforcement at every backend write boundary;
- server-side data-scope enforcement;
- pilot validation for Sales, Finance, Operations, Customer Success, and Workspace Owner;
- review of custom and multi-role navigation behavior with real customer roles.
