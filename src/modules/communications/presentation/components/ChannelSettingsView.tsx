import type { useChannelSettings } from "../hooks/useChannelSettings";
import { TelegramConnectionPanel } from "./TelegramConnectionPanel";

export function ChannelSettingsView(c: ReturnType<typeof useChannelSettings>) {
  const t = (vi: string, en: string) => c.vi ? vi : en;
  const title = t("Communications · Kênh kết nối", "Communications · Channel connections");
  if (c.state.kind !== "ready") {
    const message = c.state.kind === "loading" ? t("Đang tải kênh kết nối…", "Loading channels…")
      : c.state.kind === "denied" ? t("Bạn không có quyền quản lý kênh kết nối.", "You do not have permission to manage channels.")
      : c.state.kind === "authentication" ? t("Phiên đăng nhập đã hết hạn.", "Your session has expired.")
      : c.state.kind === "unavailable" ? t("Quản lý kênh chưa khả dụng.", "Channel management is unavailable.")
      : t("Không thể tải kênh kết nối. Vui lòng thử lại.", "Could not load channels. Please retry.");
    return <section className="p-6"><h1>{title}</h1><p role={c.state.kind === "loading" ? "status" : "alert"}>{message}</p>{c.state.kind === "error" && <button onClick={c.refresh}>{t("Thử lại", "Retry")}</button>}</section>;
  }
  const { page, providers } = c.state;
  const statusLabel = (status: string) => status === "DRAFT" ? t("Bản nháp", "Draft") : status === "DISABLED" ? t("Đã vô hiệu hóa", "Disabled") : t("Chưa xác minh", "Unverified");
  const busy = c.status === "saving";
  return <section className="space-y-5 p-6" data-guidance-id="communications.channels">
    <h1 className="text-xl font-semibold">{title}</h1>
    <p>{t("Quản lý độc lập nhiều tài khoản. Kiểm tra trạng thái cho phép, xác minh và polling trong từng tài khoản Telegram; live mặc định bị chặn.", "Manage multiple accounts independently. Review admission, verification and polling in each Telegram account; live access is blocked by default.")}</p>
    <dl className="grid grid-cols-2 gap-3 rounded border p-4 md:grid-cols-6">
      {[[t("Tổng tài khoản", "Total accounts"), page.summary.total], [t("Bản nháp", "Drafts"), page.summary.drafts], [t("Connected thực", "Live connected"), page.summary.connected], [t("Vô hiệu hóa", "Disabled"), page.summary.disabled], [t("Chưa xác minh", "Unverified"), page.summary.unverified], [t("Loại provider đang dùng", "Provider types used"), page.summary.providerTypes]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}
    </dl>
    <div className="flex flex-wrap gap-3">
      <label>{t("Provider", "Provider")} <select aria-label={t("Lọc provider", "Filter provider")} value={c.provider} onChange={e => c.filter(e.target.value, c.filterStatus)}><option value="">{t("Tất cả", "All")}</option>{providers.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
      <label>{t("Trạng thái", "Status")} <select value={c.filterStatus} onChange={e => c.filter(c.provider, e.target.value)}><option value="">{t("Tất cả", "All")}</option>{["DRAFT", "DISABLED", "UNVERIFIED"].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></label>
      <button className="rounded bg-indigo-600 px-3 py-2 text-white" onClick={c.add} disabled={busy}>{t("Thêm kết nối", "Add connection")}</button>
    </div>
    {c.status !== "idle" && c.status !== "saving" && <p role="alert">{c.status === "conflict" ? t("Cấu hình đã thay đổi. Đã tải lại; hãy kiểm tra trước khi thử lại.", "Configuration changed. Reloaded; review before retrying.") : c.status === "validation" ? t("Kiểm tra tên kết nối và provider.", "Check the connection name and provider.") : t("Không thể lưu cấu hình. Hãy kiểm tra quyền hoặc thử lại.", "Could not save configuration. Check access or retry.")}</p>}
    {page.items.length === 0 && <p>{t("Chưa có tài khoản phù hợp. Bạn có thể thêm nhiều tài khoản cùng provider.", "No matching accounts. You can add multiple accounts for the same provider.")}</p>}
    <ul className="space-y-3">{page.items.map(row => <li key={row.id} className="rounded border p-4">
      <h2 className="font-semibold">{row.displayName ?? t("Tài khoản cũ chưa được cấu hình", "Unconfigured legacy account")}</h2>
      <p>{providers.find(p => p.key === row.providerKey)?.name ?? "—"} · {statusLabel(row.status)}</p>
      <p className="break-all text-xs">ID: {row.id} · v{row.configurationVersion}</p>
      {row.providerKey !== "telegram" && <><p>{t("Kết nối thực / nhận / gửi: Chưa triển khai", "Live connection / inbound / outbound: Not implemented")}</p><p>{t("Xác minh gần nhất: Chưa có", "Last verified: None")}</p></>}
      {row.providerKey === "telegram" && <TelegramConnectionPanel id={row.id} version={row.configurationVersion} vi={c.vi} refresh={c.refresh} />}
      {row.status !== "UNVERIFIED" && <div className="mt-2 flex gap-3"><button disabled={busy} onClick={() => c.edit(row)}>{t("Đổi tên", "Rename")}</button><button disabled={busy} onClick={() => c.toggle(row)}>{row.status === "DISABLED" ? t("Bật lại bản nháp", "Re-enable draft") : t("Vô hiệu hóa", "Disable")}</button></div>}
      {row.providerKey !== "telegram" && <button disabled title={t("Chưa có provider adapter", "Provider adapter not implemented")}>{t("Kết nối / Xác minh / Ngắt provider chưa hỗ trợ", "Connect / Verify / Provider disconnect unsupported")}</button>}
    </li>)}</ul>
    <div className="flex gap-3"><button onClick={c.first}>{t("Trang đầu", "First page")}</button><button disabled={!page.nextCursor} onClick={c.more}>{t("Trang tiếp", "Next page")}</button><span>{t("Tổng theo bộ lọc", "Filtered total")}: {page.totalCount}</span></div>
    {c.draft && <form className="space-y-3 rounded border bg-white p-4" onSubmit={e => { e.preventDefault(); c.save(); }} aria-label={t("Cấu hình kênh", "Channel configuration")}>
      <label className="block">Provider <select aria-label="Provider" disabled={busy || c.draft.id !== null} value={c.draft.providerKey} onChange={e => c.draft && c.changeDraft({ ...c.draft, providerKey: e.target.value })}>{providers.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
      <label className="block">{t("Tên kết nối", "Display name")} <input aria-label={t("Tên kết nối", "Display name")} required maxLength={160} disabled={busy} value={c.draft.displayName} onChange={e => c.draft && c.changeDraft({ ...c.draft, displayName: e.target.value })} /></label>
      <p>{t("Chỉ lưu bản nháp, không nhập mật khẩu, API key hoặc token.", "Save a draft only. Do not enter passwords, API keys or tokens.")}</p>
      <div className="flex gap-3"><button disabled={busy} type="submit">{busy ? t("Đang lưu…", "Saving…") : t("Lưu bản nháp", "Save draft")}</button><button disabled={busy} type="button" onClick={c.cancel}>{t("Hủy", "Cancel")}</button></div>
    </form>}
  </section>;
}
