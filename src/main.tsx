import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import { I18nProvider } from "./i18n";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { bootstrapApplicationComposition } from "./app/bootstrap";

/**
 * Route blocking is a data-router capability. Keep a hash-based URL contract
 * while providing the DataRouterContext required by useBlocker. A declarative
 * <HashRouter> cannot satisfy that contract.
 */
async function renderApplication(): Promise<void> {
  await bootstrapApplicationComposition();

  const router = createHashRouter([
    {
      path: "*",
      element: <App />,
    },
  ]);

  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Application root element is unavailable.");
  createRoot(rootElement).render(
    <StrictMode>
      <AppErrorBoundary>
        <I18nProvider>
          {/**
           * Commit location synchronously. Canonical screens are lazy and their
           * route-local Suspense boundaries own loading/error states.
           */}
          <RouterProvider router={router} useTransitions={false} />
        </I18nProvider>
      </AppErrorBoundary>
    </StrictMode>,
  );
}

void renderApplication().catch(renderApplicationBootstrapFailure);

function renderApplicationBootstrapFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown startup failure";
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Unicore CRM startup failed before the root element was available.", error);
    return;
  }

  const isVietnamese = (document.documentElement.lang || navigator.language)
    .toLowerCase()
    .startsWith("vi");
  const copy = isVietnamese
    ? {
        eyebrow: "Khởi động connected đã bị chặn",
        title: "Không thể khởi động Unicore CRM",
        description: "Cấu hình API, danh tính hoặc workspace bắt buộc đang thiếu hoặc không hợp lệ. Ứng dụng đã dừng trước khi tải dữ liệu.",
      }
    : {
        eyebrow: "Connected startup blocked",
        title: "Unicore CRM could not start safely",
        description: "Required API, identity or workspace configuration is missing or invalid. No application data was loaded.",
      };

  createRoot(rootElement).render(
    <StrictMode>
      <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
        <section role="alert" className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">{copy.eyebrow}</p>
          <h1 className="mt-3 text-2xl font-semibold [overflow-wrap:anywhere]">{copy.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{copy.description}</p>
          <pre className="mt-5 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{message}</pre>
        </section>
      </main>
    </StrictMode>,
  );
}
