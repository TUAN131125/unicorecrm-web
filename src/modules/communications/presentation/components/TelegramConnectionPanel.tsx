import { useState } from "react";
import { useTelegramConnection } from "../hooks/useTelegramConnection";

export function TelegramCredentialForm({ save, vi, blocked }: { save: (token: string) => void; vi: boolean; blocked: boolean }) {
  const [token, setToken] = useState("");
  return <form autoComplete="off" onSubmit={e => { e.preventDefault(); const submitted = token; setToken(""); save(submitted); }}>
    <label>Bot Token <input aria-label="Bot Token" type="password" autoComplete="new-password" disabled={blocked} maxLength={256} value={token} onChange={e => setToken(e.target.value)} /></label>
    <button type="submit" disabled={blocked || token.length < 8}>{vi ? "Lưu / Thay thông tin xác thực" : "Save / Replace credential"}</button>
    <button type="button" onClick={() => setToken("")}>{vi ? "Hủy token" : "Cancel token"}</button>
  </form>;
}

export function TelegramConnectionPanel({ id, version, vi, refresh }: { id: string; version: number; vi: boolean; refresh: () => void }) {
  const c = useTelegramConnection(id, version, refresh);
  return <TelegramConnectionView c={c} vi={vi} />;
}

export function TelegramConnectionView({ c, vi }: { c: ReturnType<typeof useTelegramConnection>; vi: boolean }) {
  const t = (v: string, e: string) => vi ? v : e;
  const value = c.value;
  const busy = c.status === "saving";
  const admitted = value?.providerAllowed === true && value.securityReady;
  const verified = value?.verificationState === "VERIFIED" || value?.verificationState === "SYNTHETIC_VERIFIED";
  const canVerify = admitted && value?.enabled && value.credentialPresent && value.configurationState === "CONFIGURED" && !value.active;
  const canActivate = canVerify && verified && value?.health === "READY_TO_ACTIVATE";
  return <section aria-label="Telegram configuration" className="mt-3 space-y-2 rounded border p-3" data-guidance-id="communications.telegram-lifecycle">
    <h3>{vi ? "Cấu hình Telegram" : "Telegram configuration"}</h3>
    {!value ? <><p role="status">{c.status === "loading" ? t("Đang tải cấu hình…", "Loading configuration…") : c.status === "conflict" ? t("Cấu hình đã thay đổi. Kiểm tra lại trước khi thử.", "Configuration changed. Review before retry.") : c.status === "denied" ? t("Không có quyền truy cập.", "Access denied.") : c.status === "missing" ? t("Không tìm thấy tài khoản trong Workspace hiện tại.", "Account not found in the current Workspace.") : c.status === "security" ? "SECURITY_NOT_READY" : c.status === "admission" ? "LIVE_NOT_ADMITTED" : t("Không thể tải cấu hình.", "Configuration unavailable.")}</p><button onClick={c.retry}>{vi ? "Thử lại cấu hình" : "Retry configuration"}</button></>
      : <>
        <p>{value.credentialPresent ? t("Đã cấu hình thông tin xác thực.", "Credential configured.") : t("Chưa có thông tin xác thực.", "No credential configured.")}</p>
        <p>{t("Cấu hình", "Configuration")}: {value.configurationState} · {t("Tài khoản", "Account")}: {value.enabled ? t("Được bật", "Enabled") : t("Đã tắt", "Disabled")}</p>
        <p>{t("Xác minh Bot", "Bot verification")}: {value.verificationState} · {t("Vận hành", "Runtime")}: {value.health}</p>
        <p>{t("Inbound được kích hoạt", "Inbound activated")}: {value.active ? t("Có", "Yes") : t("Không", "No")} · g{value.credentialGeneration} / c{value.connectionGeneration}</p>
        {value.botId && <p>{value.verificationState === "SYNTHETIC_VERIFIED" ? t("Bot xác minh synthetic", "Synthetic verified bot") : t("Bot đã xác minh", "Verified bot")}: {value.botId}</p>}
        <p>{t("Xác minh gần nhất", "Last verification")}: {value.lastVerifiedAt ?? "—"}</p>
        <p>{t("Polling thành công gần nhất", "Last successful poll")}: {value.lastSuccessfulPollAt ?? "—"}</p>
        <p>{t("Cập nhật đã lưu gần nhất", "Last committed update")}: {value.lastCommittedUpdateAt ?? "—"}</p>
        <p>{t("Thử lại sau", "Retry after")}: {value.retryAfter ?? "—"}</p>
        {value.lastError && <p role="alert">{t("Lỗi kết nối", "Connection error")}: {value.lastError}</p>}
        {!value.securityReady && <p role="alert">SECURITY_NOT_READY — {t("Chưa sẵn sàng lưu thông tin xác thực.", "Credential custody is not ready.")}</p>}
        {!value.liveAllowed && <p>{t("Xác minh live chưa được phép. Không nhập token thật.", "Live verification not admitted. Do not enter real tokens.")}{value.providerAllowed && ` ${t("Chỉ môi trường synthetic được cho phép.", "Only the synthetic environment is admitted.")}`}</p>}
        <TelegramCredentialForm key={`${c.formKey}:${c.status}`} vi={vi} save={c.save} blocked={!admitted || busy} />
        <div className="flex flex-wrap gap-2">
          <button disabled={!canVerify || busy} onClick={() => c.lifecycle("verify")}>{t("Xác minh Bot", "Verify Bot")}</button>
          <button disabled={!canActivate || busy} onClick={() => c.lifecycle("activate")}>{t("Kích hoạt Inbound", "Activate Inbound")}</button>
          <button disabled={!value.active || busy} onClick={() => c.lifecycle("deactivate")}>{t("Dừng Inbound", "Deactivate Inbound")}</button>
          <button disabled={!admitted || !value.enabled || !value.credentialPresent || value.active || busy} onClick={() => c.lifecycle("reconnect")}>{t("Kết nối lại", "Reconnect")}</button>
          <button disabled={value.configurationState === "DISCONNECTED" || busy} onClick={c.disconnect}>{t("Ngắt kết nối", "Disconnect")}</button>
          <button disabled={!value.credentialPresent || busy} onClick={c.remove}>{t("Xóa thông tin xác thực cục bộ", "Remove local credential")}</button>
          <button disabled={busy} onClick={c.retry}>{t("Cập nhật trạng thái", "Refresh connection health")}</button>
        </div>
        <p>{t("Đã xác minh không có nghĩa polling đang hoạt động. Ngắt kết nối giữ thông tin xác thực đã mã hóa và lịch sử; cần xác minh lại trước khi kích hoạt. Xóa cục bộ không thu hồi token tại Telegram.", "Verification does not prove polling is operational. Disconnect retains the protected credential and history; verify again before activation. Local removal does not revoke the token at Telegram.")}</p>
      </>}
  </section>;
}
