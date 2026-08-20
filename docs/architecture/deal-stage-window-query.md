# Deal Kanban Stage-Window Query

Connected Kanban mode does not load the complete Deal collection. It requests a bounded window for each active stage, with an independent cursor and total count.

Each request carries workspace context through the shared HTTP authority and sends search, ownership, close-date and minimum-amount filters to the backend. Returned records must belong to the requested stage. A stage that reports more records must provide a `nextCursor`.

The UI shows loaded/total counts and offers an independent Load More action per column. Switching workspace, filters, stage configuration or view mode aborts active requests and clears the previous projection before the next authority response is displayed.

Table mode remains a separate query surface. Drag-and-drop commands continue through the typed mutation authority; backend ordering remains authoritative after a refresh.
