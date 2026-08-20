export const getTranslatedSource = (source: string | undefined, t: (key: string) => string): string => {
  if (!source) return "-";
  const clean = source.trim();
  if (clean === "Website") return t("contactList.source.website");
  if (clean === "Hội thảo / Webinar") return t("contactList.source.webinar");
  if (clean === "Giới thiệu / Referral") return t("contactList.source.referral");
  if (clean === "Facebook") return t("contactList.source.facebook");
  if (clean === "Google Search") return t("contactList.source.googleSearch");
  if (clean === "Google Ads") return t("contactList.source.googleAds");
  if (clean === "Zalo") return t("contactList.source.zalo");
  if (clean === "Tư vấn trực tiếp") return t("contactList.source.directConsult");
  if (clean === "Facebook Ads") return t("contactList.source.facebookAds");
  return source;
};

export const getContactStatusLabel = (status: string, t: (key: string) => string): string => {
  const normalized = status.toLowerCase();
  const labelKeys: Record<string, string> = {
    active: "contactStatus.active",
    needs_follow_up: "contactStatus.needs_follow_up",
    in_consulting: "contactStatus.in_consulting",
    has_open_opportunity: "contactStatus.has_open_opportunity",
    inactive: "contactStatus.inactive",
    do_not_contact: "contactStatus.do_not_contact",
    archived: "contactStatus.archived"
  };
  const key = labelKeys[normalized] || `contactStatus.${status}`;
  return t(key);
};

export const getContactPriorityLabel = (key: string, t: (key: string) => string): string => {
  const normalized = key.toLowerCase();
  const labels: Record<string, string> = {
    low: t("contactList.priority.low"),
    medium: t("contactList.priority.medium"),
    high: t("contactList.priority.high"),
    urgent: t("contactList.priority.urgent")
  };
  return labels[normalized] ?? key;
};
