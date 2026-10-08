import React from "react";
import { SavedViewNameModal } from "@/components/crm/SavedViewNameModal";

interface LeadAddViewModalProps {
  isOpen: boolean;
  onClose(): void;
  onConfirm(viewName: string, deferClose?: boolean): Promise<boolean>;
  initialName?: string;
  mode?: "create" | "edit";
}

export function LeadAddViewModal({
  isOpen,
  onClose,
  onConfirm,
  initialName = "",
  mode = "create",
}: LeadAddViewModalProps) {
  const [name, setName] = React.useState(initialName);
  const wasOpen = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !wasOpen.current) setName(initialName);
    wasOpen.current = isOpen;
  }, [initialName, isOpen]);

  return (
    <SavedViewNameModal
      isOpen={isOpen}
      onClose={onClose}
      mode={mode}
      name={name}
      onNameChange={setName}
      onSave={(value) => onConfirm(value, true)}
      onSubmit={async (event) => {
        event.preventDefault();
        if (name.trim()) await onConfirm(name.trim());
      }}
      formId="lead-saved-view-form"
    />
  );
}
