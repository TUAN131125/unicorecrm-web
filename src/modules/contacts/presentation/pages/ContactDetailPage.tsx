import React from "react";
import type { ContactDetailPageProps } from "../hooks/useContactDetailController";
import { useContactDetailPageController } from "../hooks/useContactDetailPageController";
import { ContactDetailView } from "../views/ContactDetailView";
import { ContactDetailResourceView } from "../views/ContactDetailResourceView";

export const ContactDetailPage: React.FC<ContactDetailPageProps> = (props) => {
  const model = useContactDetailPageController(props);
  return <ContactDetailResourceView model={model}>{model.controller ? <ContactDetailView controller={model.controller} /> : null}</ContactDetailResourceView>;
};
