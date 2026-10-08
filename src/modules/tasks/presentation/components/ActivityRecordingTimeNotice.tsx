import React from "react";
import { useI18n } from "@/i18n";

export function ActivityRecordingTimeNotice({ customDateUnavailable = false }: { customDateUnavailable?: boolean }) {
  const { locale } = useI18n();
  return <p role={customDateUnavailable ? "alert" : "status"} className="text-xs text-slate-500">
    {customDateUnavailable
      ? (locale === "vi" ? "Chưa hỗ trợ thời điểm ghi nhận tùy chọn. Hãy mở lại biểu mẫu để ghi nhận theo thời gian máy chủ." : "Custom recording dates are unavailable. Reopen the form to record using server time.")
      : (locale === "vi" ? "Thời điểm ghi nhận do máy chủ xác định khi lưu. Không thể chọn thời điểm tùy chỉnh." : "The server assigns the recorded time when saving. A custom recording date cannot be selected.")}
  </p>;
}
