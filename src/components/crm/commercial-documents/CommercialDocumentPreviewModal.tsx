import React from "react";
import { Modal } from "@/shared/components/ui";

export interface CommercialDocumentPreviewModalProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const CommercialDocumentPreviewModal: React.FC<CommercialDocumentPreviewModalProps> = ({
  id,
  isOpen,
  onClose,
  title,
  children,
  footer,
}) => (
  <Modal
    id={id}
    isOpen={isOpen}
    onClose={onClose}
    size="lg"
    title={title}
    scrollBody={false}
    bodyClassName="bg-slate-100 p-0"
    footer={footer}
  >
    <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
      <div className="flex min-w-[968px] justify-center">
        <div className="w-max shrink-0">{children}</div>
      </div>
    </div>
  </Modal>
);
