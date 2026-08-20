import React from "react";
import { ContactRound, ExternalLink, FileText, Plus } from "lucide-react";
import { Badge, Button } from "@/shared/components/ui";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";
import type { Customer360ReadModel } from "../model/customer360ReadModel";
import { EmptyState, SectionHeader } from "./CustomerDetailSectionPrimitives";

export const NotesTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onCreateNote(): void;
  onOpenSource(): void;
}> = ({ model, isVi, onCreateNote, onOpenSource }) => {
  const notes = model.identity.contacts.flatMap((contact) =>
    [
      contact.notes
        ? {
            id: `${contact.id}-notes`,
            source: contact.fullName || contact.name,
            body: contact.notes,
            kind: isVi ? "Ghi chú Contact" : "Contact note",
          }
        : undefined,
      contact.internalNotes
        ? {
            id: `${contact.id}-internal`,
            source: contact.fullName || contact.name,
            body: contact.internalNotes,
            kind: isVi ? "Ghi chú nội bộ" : "Internal note",
          }
        : undefined,
      ...(contact.activities ?? [])
        .filter((activity) =>
          String(activity.type).toLocaleLowerCase().includes("note"),
        )
        .map((activity) => ({
          id: `${contact.id}-${activity.id}`,
          source: contact.fullName || contact.name,
          body: activity.description || activity.title,
          kind: isVi ? "Hoạt động ghi chú" : "Note activity",
        })),
    ].filter(
      (
        item,
      ): item is { id: string; source: string; body: string; kind: string } =>
        Boolean(item),
    ),
  );

  const customerNotes = model.activities
    .filter((activity) => activity.type === "NOTE")
    .map((activity) => ({
      id: activity.id,
      source: isVi ? "Customer 360" : "Customer 360",
      body: activity.body || activity.subject,
      kind: isVi ? "Ghi chú Customer" : "Customer note",
    }));

  const allNotes = [...customerNotes, ...notes];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isVi ? "Ghi chú hợp nhất" : "Unified notes"}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<ExternalLink size={12} />}
              onClick={onOpenSource}
            >
              {isVi ? "Mở hồ sơ nguồn" : "Open source"}
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={12} />}
              onClick={onCreateNote}
            >
              {isVi ? "Thêm ghi chú" : "Add note"}
            </Button>
          </>
        }
      />
      {allNotes.length > 0 ? (
        allNotes.map((note) => (
          <div
            key={note.id}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                {note.kind}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                {note.source}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-[11px] font-medium leading-5 text-slate-600">
              {note.body}
            </p>
          </div>
        ))
      ) : (
        <EmptyState
          icon={<FileText size={20} />}
          text={isVi ? "Chưa có ghi chú." : "No notes yet."}
          action={
            <Button size="sm" variant="primary" onClick={onCreateNote}>
              {isVi ? "Tạo ghi chú đầu tiên" : "Create first note"}
            </Button>
          }
        />
      )}
    </div>
  );
};

export const ContactsTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onOpenContact(id: string): void;
  onManageSource(): void;
}> = ({ model, isVi, onOpenContact, onManageSource }) => (
  <div className="space-y-3">
    <SectionHeader
      title={isVi ? "Mạng lưới liên hệ" : "Contact network"}
      actions={
        <Button
          size="sm"
          variant="primary"
          icon={<ExternalLink size={12} />}
          onClick={onManageSource}
        >
          {model.customer.type === "B2B"
            ? isVi
              ? "Quản lý đại diện"
              : "Manage representatives"
            : isVi
              ? "Mở Contact"
              : "Open Contact"}
        </Button>
      }
    />
    {model.identity.contacts.length > 0 ? (
      model.identity.contacts.map((contact) => {
        return (
          <button
            key={contact.id}
            type="button"
            onClick={() => onOpenContact(contact.id)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-indigo-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                  <ContactRound size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-800">
                      {contact.fullName || contact.name}
                    </span>
                    {model.identity.primaryContact?.id === contact.id && (
                      <Badge variant="warning">
                        {isVi ? "Liên hệ chính" : "Primary"}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-500">
                    {contact.roleTitle || contact.title || "—"} ·{" "}
                    {contact.workEmail ||
                      contact.email ||
                      contact.personalEmail ||
                      "—"}{" "}
                    · {contact.mobilePhone || contact.phone || "—"}
                  </div>
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-400">
                {resolveWorkspaceMemberName(contact.ownerId)}
              </div>
            </div>
          </button>
        );
      })
    ) : (
      <EmptyState
        icon={<ContactRound size={20} />}
        text={isVi ? "Không có Contact nguồn." : "No source Contacts."}
        action={
          <Button size="sm" variant="primary" onClick={onManageSource}>
            {isVi ? "Mở hồ sơ nguồn" : "Open source"}
          </Button>
        }
      />
    )}
  </div>
);
