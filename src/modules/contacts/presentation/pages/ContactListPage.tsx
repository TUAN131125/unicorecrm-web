import React from "react";
import { AuthoritativeQueryBoundary } from "@/shared/operations";
import { useContactListController, type ContactListPageProps } from "../hooks/useContactListController";
import { ContactListView } from "../views/ContactListView";

export const ContactListPage: React.FC<ContactListPageProps> = (props) => {
  const controller = useContactListController(props);
  return (
    <AuthoritativeQueryBoundary
      query={controller.contactQuery}
      hasData={controller.contacts.length > 0}
      loadingTitleVi="Đang tải danh sách liên hệ"
      loadingTitleEn="Loading contacts"
      errorTitleVi="Không thể tải danh sách liên hệ"
      errorTitleEn="Contacts could not be loaded"
    >
      <ContactListView controller={controller} />
    </AuthoritativeQueryBoundary>
  );
};
