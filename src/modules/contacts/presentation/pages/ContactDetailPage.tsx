import React from "react";
import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { AuthoritativeQueryNotice } from "@/shared/operations";
import { useContactDetailController, type ContactDetailPageProps } from "../hooks/useContactDetailController";
import { ContactDetailView } from "../views/ContactDetailView";

export const ContactDetailPage: React.FC<ContactDetailPageProps> = (props) => {
  const controller = useContactDetailController(props);
  const navigate = useNavigate();
  const { tx } = useI18n();
  if (!controller) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 space-y-4 bg-slate-50 min-w-0">
      <ShieldAlert className="text-rose-500 w-12 h-12" />
      <h2 className="text-lg font-bold text-slate-800">{tx("contactDetail.notExistError", "Liên hệ không tồn tại trên hệ thống.")}</h2>
      <button onClick={() => navigate("/contacts")} className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 font-sans shadow-sm cursor-pointer">{tx("common.back", "Quay lại")}</button>
    </div>
  );
  return <><AuthoritativeQueryNotice connected={controller.contactQuery.connected} loading={controller.contactQuery.loading} refreshing={controller.contactQuery.refreshing} stale={controller.contactQuery.stale} loadedAt={controller.contactQuery.loadedAt} error={controller.contactQuery.error} onRefresh={() => void controller.contactQuery.refresh()} compact /><ContactDetailView controller={controller} /></>;
};
