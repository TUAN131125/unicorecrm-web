# Guidance system

> **Status:** CURRENT  
> **Scope:** Frontend contextual guidance and user-operation walkthroughs

The guidance system provides bilingual, capability-aware help for CRM, Studio, and People & Access. It explains how to use each active screen without becoming a business-authority layer or keeping retired routes alive.

## Current screen inventory

The repository defines **80 total route definitions**, **12 access/system routes**, **68 canonical route entries**, and **66 guided screens**. The inventory contains **51 CRM screens**, **12 Studio screens**, and **3 People & Access screens**, with **2 compatibility route aliases**. Access/system routes use inline guidance outside the authenticated shell.

The 12 access/system routes are Login, MFA verification, Forgot password, Register, Verify email, Reset password, Invitation acceptance, Workspace selection, Initial setup, Session expired, Access denied, and Account suspended. They are intentionally excluded from contextual walkthroughs because the Guidance Center is not mounted before authentication or workspace selection.

A complete route-by-route list is maintained in [`guidance-screen-inventory.md`](./guidance-screen-inventory.md).

The catalog also contains:

- 8 cross-screen workflow guides.
- 22 field-help entries.
- 4 CRM-oriented checklists.

Quick Setup is one of the 12 Studio screens. It is optional orchestration metadata, not a mandatory onboarding checklist or a configuration authority. There is no redirect guidance for removed Studio routes.

## Walkthrough completeness

Every active guided screen includes bilingual content for:

1. Screen purpose and intended audience.
2. Prerequisites and required access.
3. Every declared primary task, in order.
4. Screen-specific interactive targets when available.
5. Common mistakes and completion checks.
6. Product-space context.
7. The persistent action for reopening guidance.

The registry enriches both custom and generated guides with this complete walkthrough structure. A route cannot be added without a `guidanceId`, and a guidance entry cannot remain active without a routed screen.

## Runtime rules

- Guidance follows canonical workspace-scoped routes.
- Search results are filtered by effective capability.
- Missing walkthrough targets fail safely.
- Progress is workspace-scoped browser state and is not business evidence.
- Vietnamese and English are both mandatory for all user-visible guidance fields and walkthrough steps.
- Removed content must not be retained as an active historical state (`trạng thái lịch sử`) or used to restore retired routes.
- Studio guidance explains the owning configuration surface, save boundary, and the difference between saved configuration and verified external connectivity.
- Feature Usage guidance explains search, module switches, the required Customer 360 foundation, and the need to save before leaving.

## Ownership

- `src/guidance/application/guidanceRegistry.ts` composes the active catalog.
- `src/guidance/content/shared/createScreenGuidance.ts` guarantees the complete walkthrough structure for every screen.
- `src/guidance/content/crm/**` owns the 51 CRM screen guides.
- `src/guidance/content/studio/configuration.ts` owns the 11 Studio screen guides.
- `src/guidance/content/people/**` owns the 3 People & Access screen guides.
- `src/app/routes/routeMeta.ts` owns the active route-to-guidance mapping.
- `src/workspaces/studio/navigation/studioSectionRegistry.ts` owns the approved Studio section list.

## Maintenance rule

When adding, renaming, or retiring a screen:

1. Update the canonical route and `ROUTE_METADATA`.
2. Add or update exactly one screen-guidance entry.
3. Provide at least two primary tasks, prerequisites, common mistakes, keywords, and complete VI/EN copy.
4. Add screen-specific `data-guidance-id` targets when the generic route-content target is not sufficient.
5. Run the guidance contract and runtime gates.
6. Update the inventory numbers in this document only through the same change that modifies the route catalog.

## Verification

```bash
npm run quality:gate -- --gate quality.guidance-contracts
npm run quality:gate -- --gate quality.guidance-runtime
npm run quality:gate -- --gate quality.bilingual-ui
npm run quality:gate -- --gate quality.studio-single-authority
npm run quality:gate -- --gate quality.studio-quick-setup
```
