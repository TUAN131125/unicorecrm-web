import React from "react";
import { MessageSquare } from "lucide-react";
import { useI18n } from "@/i18n";
import { RelationshipModuleActions, RelationshipWorkspaceHeader } from "@/components/crm/relationship-detail";

interface Note { id: string; title: string; body: string; date: string; pinned?: boolean }
interface ContactNotesTabProps {
  contactNotes: Note[];
  onOpenComposer?(): void;
  isArchived?: boolean;
}

/** Profile notes are edited by the canonical Contact PATCH form; new notes use Activity commands. */
export function ContactNotesTab({ contactNotes = [], onOpenComposer, isArchived = false }: ContactNotesTabProps) {
  const { tx, locale } = useI18n();
  return <div id="contact-notes-tab" className="space-y-5 text-sm">
    <RelationshipWorkspaceHeader
      title={`${tx("contactDetail.notes.tabTitle", "Ghi chú")} (${contactNotes.length})`}
      actions={!isArchived && onOpenComposer ? <RelationshipModuleActions primaryLabel={tx("contactDetail.notes.createNewBtn", "Thêm ghi chú")} onPrimary={onOpenComposer} /> : undefined}
    />
    <p className="text-xs text-slate-500">{locale === "vi" ? "Sửa ghi chú hồ sơ trong biểu mẫu Sửa liên hệ. Ghi chú hoạt động mới được ghi nhận trong lịch sử hoạt động." : "Edit profile notes in Edit Contact. New activity notes are recorded in activity history."}</p>
    {contactNotes.length ? contactNotes.map(note => <article key={note.id} className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="font-semibold text-slate-900">{note.title}</h4>
      <p className="mt-1 text-xs text-slate-500">{note.date}</p>
      <p className="mt-3 whitespace-pre-wrap text-slate-700">{note.body}</p>
    </article>) : <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-500">
      <MessageSquare className="mx-auto mb-2" size={22} />
      {tx("contactDetail.notes.empty", "Chưa có ghi chú.")}
    </div>}
  </div>;
}
