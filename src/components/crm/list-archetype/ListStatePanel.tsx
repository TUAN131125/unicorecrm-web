import React from "react";
import { AlertTriangle, Inbox, Loader2, ShieldAlert } from "lucide-react";

export type ListStateKind = "loading" | "empty" | "error" | "permission";

interface ListStatePanelProps {
  kind: ListStateKind;
  title: string;
  action?: React.ReactNode;
}

const icons: Record<ListStateKind, React.ReactNode> = {
  loading: <Loader2 size={28} className="animate-spin" />,
  empty: <Inbox size={30} />,
  error: <AlertTriangle size={30} />,
  permission: <ShieldAlert size={30} />,
};

export const ListStatePanel: React.FC<ListStatePanelProps> = ({
  kind,
  title,
  action,
}) => (
  <div
    data-list-state={kind}
    className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center"
  >
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      {icons[kind]}
    </div>
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    {action && <div className="mt-5">{action}</div>}
  </div>
);
