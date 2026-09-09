import React, { useState } from "react";
import { Printer } from "lucide-react";
import { useI18n } from "@/i18n";
import { ActionDropdown, type ActionDropdownSection } from "@/components/crm/ActionDropdown";
import { PageHeaderMoreButton } from "@/components/crm/PageHeaderActions";

export type ContactTopActionMenuProps = {
  canReadContacts: boolean;
  onPrintList: () => void;
};

/** Presentation-only actions. Import, export and bulk mutations remain absent until admitted. */
export const ContactTopActionMenu: React.FC<ContactTopActionMenuProps> = ({ canReadContacts, onPrintList }) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (!canReadContacts) return null;

  const sections: ActionDropdownSection[] = [{
    id: "general",
    title: t("contactList.actions.moreActions"),
    items: [{ id: "print", label: t("contactList.actions.printList"), icon: <Printer size={13} />, onClick: onPrintList }],
  }];

  return (
    <div className="relative inline-block text-left">
      <PageHeaderMoreButton
        active={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          setAnchorEl(event.currentTarget);
          setIsOpen((current) => !current);
        }}
        title={t("contactList.actions.moreActions")}
      />
      <ActionDropdown
        isOpen={isOpen}
        anchorRef={anchorEl}
        onClose={() => { setIsOpen(false); setAnchorEl(null); }}
        sections={sections}
        width={240}
      />
    </div>
  );
};
