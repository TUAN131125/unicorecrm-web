import React from "react";
import { AuthoritativeQueryNotice } from "@/shared/operations";
import { useContactListController, type ContactListPageProps } from "../hooks/useContactListController";
import { ContactListView } from "../views/ContactListView";

export const ContactListPage: React.FC<ContactListPageProps> = (props) => {
  const controller = useContactListController(props);
  return (
    <>
      <AuthoritativeQueryNotice connected={controller.contactQuery.connected} loading={controller.contactQuery.loading} refreshing={controller.contactQuery.refreshing} stale={controller.contactQuery.stale} loadedAt={controller.contactQuery.loadedAt} error={controller.contactQuery.error} onRefresh={() => void controller.contactQuery.refresh()} compact />
      <ContactListView controller={controller} />
    </>
  );
};
