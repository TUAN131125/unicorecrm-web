# Entry Code Splitting and Bundle Budget

The public application entry must contain only startup, authentication routing and the minimal loading experience. Authentication screens and the authenticated CRM shell are lazy route boundaries.

Production builds emit a Vite manifest and run the canonical assertion `tests/quality/architecture/check-bundle-budget.mjs` directly through the manifest-owned build gate. The entry chunk and every JavaScript chunk must remain at or below 500 KiB minified. The budget is an assertion, not a warning threshold; builds fail when it is exceeded.

Large optional capabilities such as the authenticated shell, the Studio replacement route, audit viewer, AI assistant, charts and document export remain outside the public entry and are loaded only by their owning route or interaction.
