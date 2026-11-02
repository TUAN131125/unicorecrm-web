import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { useWorkspaceContextSnapshot, isConnectedWorkspaceRuntime } from "@/platform/workspace-context";

export function ConnectionsPageFrame({ title, description, actions, children }: { title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  const { locale } = useI18n();
  const workspace = useWorkspaceContextSnapshot();
  const vi = locale === "vi";
  return <main className="mx-auto w-full max-w-[1540px] px-4 py-6 pb-24 sm:px-6 lg:px-8" data-studio-surface="connections">
    <header className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">{vi ? "Studio / Kết nối & API" : "Studio / Connections & API"}</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-semibold text-slate-950">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p></div>
        {actions}
      </div>
      <p className="mt-4 text-xs text-slate-500">Workspace: {workspace.workspaceKey} · {isConnectedWorkspaceRuntime() ? (vi ? "Dữ liệu từ máy chủ" : "Server data") : (vi ? "Demo · không xác nhận kết nối thật" : "Demo · does not verify live connections")}</p>
    </header>
    <div className="mt-5 space-y-5" data-guidance-id="studio.connections.content">{children}</div>
  </main>;
}
