export interface ContactSavedView {
  key: string;
  labelKey: string;
  descriptionKey?: string;
  icon?: string;
}

export const CONTACT_SAVED_VIEWS: ContactSavedView[] = [
  { key: "allContacts", labelKey: "contactViews.allContacts", icon: "all" },
  { key: "myContacts", labelKey: "contactViews.myContacts", icon: "user" },
  { key: "teamContacts", labelKey: "contactViews.teamContacts", icon: "users" },
  { key: "needFollowUpToday", labelKey: "contactViews.needFollowUpToday", icon: "calendar" },
  { key: "overdueFollowUp", labelKey: "contactViews.overdueFollowUp", icon: "clock" },
  { key: "inConsulting", labelKey: "contactViews.inConsulting", icon: "chat" },
  { key: "hasOpenOpportunity", labelKey: "contactViews.hasOpenOpportunity", icon: "target" },
  { key: "noOpportunityYet", labelKey: "contactViews.noOpportunityYet", icon: "circle" },
  { key: "nearClosing", labelKey: "contactViews.nearClosing", icon: "alert" },
  { key: "becameCustomer", labelKey: "contactViews.becameCustomer", icon: "star" },
  { key: "doNotContact", labelKey: "contactViews.doNotContact", icon: "shield" },
  { key: "inactiveLongTime", labelKey: "contactViews.inactiveLongTime", icon: "pause" },
  { key: "duplicates", labelKey: "contactViews.duplicates", icon: "copy" },
  { key: "archived", labelKey: "contactViews.archived", icon: "archive" },
];
