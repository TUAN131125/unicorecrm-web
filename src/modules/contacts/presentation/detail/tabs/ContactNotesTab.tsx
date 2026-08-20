import React, { useState } from "react";
import { MessageSquare, Trash2, Pin, PinOff, Edit2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button, DetailTabActionButton } from "@/shared/components/ui";
import { RelationshipModuleActions, RelationshipWorkspaceHeader } from "@/components/crm/relationship-detail";
import { NoteActivityCreateModal, type NoteActivityDraft } from "@/modules/tasks";

interface Note {
  id: string;
  title: string;
  body: string;
  date: string;
  pinned?: boolean;
}

interface ContactNotesTabProps {
  contactNotes: Note[];
  onCreateNote: (data: NoteActivityDraft) => void;
  onUpdateNote: (id: string, data: { title: string; body: string }) => void;
  onDeleteNote: (id: string) => void;
  onTogglePinNote: (id: string) => void;
  isArchived?: boolean;
}

export const ContactNotesTab: React.FC<ContactNotesTabProps> = ({
  contactNotes = [],
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePinNote,
  isArchived = false,
}) => {
  const { tx } = useI18n();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isArchived) return;

    if (!editTitle.trim() || !editBody.trim() || !editingId) return;

    onUpdateNote(editingId, {
      title: editTitle.trim(),
      body: editBody.trim(),
    });

    setEditingId(null);
  };

  const startEditNote = (note: Note) => {
    if (isArchived) return;
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditBody(note.body);
  };

  // Sort: pinned first
  const sortedNotes = [...contactNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  return (
    <div id="contact-notes-tab" className="space-y-5 animate-fade-in text-[11px] text-slate-700">
      
      <RelationshipWorkspaceHeader
        title={`${tx("contactDetail.notes.tabTitle", "Ghi chú")} (${contactNotes.length})`}
        actions={!isArchived && !editingId ? <RelationshipModuleActions primaryLabel={tx("contactDetail.notes.createNewBtn", "Thêm ghi chú")} onPrimary={() => setShowAddForm(true)} /> : undefined}
      />

      {/* Canonical note create form; edit remains record-local. */}
      <NoteActivityCreateModal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        formId="contact-notes-tab-create-form"
        onSubmit={(draft) => {
          onCreateNote(draft);
          setShowAddForm(false);
        }}
      />

      {editingId ? (
        <form onSubmit={handleSaveEdit} className="crm-form-surface rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3 text-left">
          <h4 className="text-xs font-semibold text-indigo-800">{tx("contactDetail.notes.editTitle", "Chỉnh sửa ghi chú")}</h4>
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
            required
            disabled={isArchived}
          />
          <textarea
            rows={3}
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
            required
            disabled={isArchived}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              {tx("common.cancel", "Hủy bỏ")}
            </Button>
            <Button type="submit" variant="primary" disabled={isArchived}>
              {tx("common.save", "Cập nhật")}
            </Button>
          </div>
        </form>
      ) : null}

      {/* Note list */}
      <div className="space-y-3 font-sans">
        {sortedNotes.length > 0 ? (
          sortedNotes.map(nt => (
            <div 
              key={nt.id} 
              className={`rounded-xl border p-4 text-left shadow-sm hover:shadow-md transition duration-150 ${
                nt.pinned 
                  ? "border-amber-200 bg-amber-50/40" 
                  : "border-slate-100 bg-slate-50/50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {nt.pinned && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[8px] font-semibold uppercase">
                        <Pin size={8} className="fill-amber-800" />
                        <span>{tx("common.pinned", "Đã ghim")}</span>
                      </span>
                    )}
                    <p className="font-semibold text-slate-900 text-xs">{nt.title}</p>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 font-mono">
                    {tx("contactDetail.notes.meta", "Ngày viết:")} {nt.date} • {tx("contactDetail.notes.author", "Tác giả: Sales Representative")}
                  </p>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isArchived}
                    onClick={() => onTogglePinNote(nt.id)}
                    className={`p-1.5 rounded-lg border transition disabled:opacity-50 ${
                      nt.pinned 
                        ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200" 
                        : "bg-white text-slate-400 hover:text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                    title={nt.pinned ? "Bỏ ghim" : "Ghim lên đầu"}
                  >
                    {nt.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                  </button>
                  <button
                    type="button"
                    disabled={isArchived}
                    onClick={() => startEditNote(nt)}
                    className="p-1.5 rounded-lg border bg-white text-slate-400 hover:text-indigo-700 border-slate-200 hover:bg-indigo-50 transition disabled:opacity-50"
                    title="Chỉnh sửa ghi chú"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    type="button"
                    disabled={isArchived}
                    onClick={() => onDeleteNote(nt.id)}
                    className="p-1.5 rounded-lg border bg-white text-slate-400 hover:text-rose-700 border-slate-200 hover:bg-rose-50 transition disabled:opacity-50"
                    title="Xóa ghi chú"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <p className="mt-2.5 text-[11px] font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{nt.body}</p>
            </div>
          ))
        ) : (
          <div className="flex min-h-[160px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
            <MessageSquare size={24} className="mb-2 text-slate-300" />
            <span className="font-semibold">{tx("contactDetail.empty.noNotes", "Chưa có ghi chú nào được ghi nhận.")}</span>
            {!isArchived && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="mt-3 text-[10px] font-semibold text-indigo-600 hover:underline"
              >
                {tx("contactDetail.notes.emptyCTA", "Thêm ghi chú đầu tiên")}
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
