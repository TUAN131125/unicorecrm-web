import React from "react";
import {
  RecordAttachmentsTab,
  type RecordAttachmentItem,
  type RecordAttachmentUploadData,
} from "@/components/crm/detail-archetype";

interface ContactAttachmentsTabProps {
  contactAttachments: RecordAttachmentItem[];
  onUploadAttachment(data: RecordAttachmentUploadData): void;
  onDeleteAttachment(id: string): void;
  onDownloadAttachment(id: string): void;
  isArchived?: boolean;
  onModalStateChange?(open: boolean): void;
}

export const ContactAttachmentsTab: React.FC<ContactAttachmentsTabProps> = ({
  contactAttachments,
  onUploadAttachment,
  onDeleteAttachment,
  onDownloadAttachment,
  isArchived,
  onModalStateChange,
}) => (
  <RecordAttachmentsTab
    idPrefix="contact"
    attachments={contactAttachments}
    onUploadAttachment={onUploadAttachment}
    onDeleteAttachment={onDeleteAttachment}
    onDownloadAttachment={onDownloadAttachment}
    isArchived={isArchived}
    onModalStateChange={onModalStateChange}
  />
);
