export const formatDate = (value: string | Date | undefined, locale: string, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", options);
};

export const formatDateTime = (value: string | Date | undefined, locale: string, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", options);
};
