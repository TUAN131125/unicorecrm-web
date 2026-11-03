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

function renderApplicationBootstrapFailure(_error: unknown): void {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Unicore CRM startup failed before the root element was available.");
    return;
  }

  const isVietnamese = (document.documentElement.lang || navigator.language)
    .toLowerCase()
    .startsWith("vi");
  const copy = isVietnamese
    ? {
        eyebrow: "Không thể mở ứng dụng",
        title: "Không thể khởi động Unicore CRM",
        description: "Vui lòng tải lại trang. Nếu vẫn gặp lỗi, hãy liên hệ người quản trị.",
      }
    : {
        eyebrow: "Application unavailable",
        title: "Unicore CRM could not start safely",
        description: "Reload the page. If the problem continues, contact your administrator.",
      };

  createRoot(rootElement).render(
    <StrictMode>
      <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
        <section role="alert" className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">{copy.eyebrow}</p>
          <h1 className="mt-3 text-2xl font-semibold [overflow-wrap:anywhere]">{copy.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{copy.description}</p>
        </section>
      </main>
    </StrictMode>,
  );
}
