import React, { useState } from "react";
import type { useConversationCrmLink } from "../hooks/useConversationCrmLink";
import type { CrmTarget } from "../../application/CommunicationsLink";

export function ConversationCrmLinkView({ crm, vi, onOpen }: { crm: ReturnType<typeof useConversationCrmLink>; vi: boolean; onOpen?: (target: CrmTarget) => void }) {
  const [type, setType] = useState<"LEAD" | "CONTACT">("LEAD");
  const [query, setQuery] = useState("");
  const pending = crm.status === "pending";
  const permitted = crm.canWrite && crm.context?.canLink === true;
  return <section className="m-6 space-y-3 rounded border p-4" aria-label="CRM" data-guidance-id="communications-crm-link">
    <h2>{vi ? "Liên kết CRM" : "CRM link"}</h2>
    {crm.status === "loading" && <p role="status">{vi ? "Đang tải CRM…" : "Loading CRM…"}</p>}
    {crm.status === "unavailable" && <p>{vi ? "CRM chưa khả dụng." : "CRM unavailable."}</p>}
    {crm.status === "denied" && <p role="alert">{vi ? "Không có quyền truy cập CRM." : "CRM access denied."}</p>}
    {crm.status === "error" && <p role="alert">{vi ? "Không tải được CRM." : "Unable to load CRM."}</p>}
    {crm.status === "conflict" && <p role="alert">{vi ? "Hội thoại đã thay đổi. Tải lại trước khi xác nhận." : "Conversation changed. Reload before confirming."}</p>}
    {crm.context && <>
      {crm.context.state === "NONE" && <p>{vi ? "Chưa liên kết CRM." : "No CRM link."}</p>}
      {crm.context.state === "UNAVAILABLE" && <p>{vi ? "Thông tin CRM được giữ kín hoặc không khả dụng." : "CRM context withheld or unavailable."}</p>}
      {crm.context.target && <p>{crm.context.target.targetType}: {crm.context.target.label ?? (vi ? "Tên được giữ kín" : "Name withheld")} ({crm.context.target.targetId})</p>}
      {crm.context.target && onOpen && <button type="button" onClick={() => { if (crm.context?.target) onOpen(crm.context.target); }}>{vi ? "Mở bản ghi CRM" : "Open CRM record"}</button>}
      {permitted && <>
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void crm.search(type, query); }}>
          <select aria-label={vi ? "Loại bản ghi CRM" : "CRM record type"} value={type} disabled={pending} onChange={event => { setType(event.target.value === "CONTACT" ? "CONTACT" : "LEAD"); setQuery(""); }}>
            <option value="LEAD">Lead</option><option value="CONTACT">Contact</option>
          </select>
          <input aria-label={vi ? "Tìm bản ghi CRM" : "Search CRM records"} value={query} maxLength={100} disabled={pending} onChange={event => setQuery(event.target.value)} />
          <button type="submit" disabled={pending || crm.searching || !query.trim()}>{vi ? "Tìm CRM" : "Search CRM"}</button>
        </form>
        {crm.searching && <p role="status">{vi ? "Đang tìm…" : "Searching…"}</p>}
        {crm.searched && !crm.searching && crm.candidates.length === 0 && <p>{vi ? "Không có bản ghi phù hợp trong phạm vi được phép. Thử tên hoặc mã cụ thể hơn." : "No eligible records within your access. Refine the name or identifier."}</p>}
        <ul>{crm.candidates.map(target => <li key={`${target.targetType}:${target.targetId}`}><button type="button" disabled={pending} onClick={() => crm.select(target)}>
          {vi ? "Chọn" : "Select"} {target.label ?? target.targetId}
        </button></li>)}</ul>
        {crm.context.successor && <button type="button" disabled={pending} onClick={() => crm.select(crm.context?.successor ?? null)}>
          {vi ? "Lead đã qualification — Chọn Contact" : "Lead qualified — Select Contact"}: {crm.context.successor.label ?? crm.context.successor.targetId}
        </button>}
        {crm.context.state !== "NONE" && <button type="button" disabled={pending} onClick={() => crm.select(null)}>{vi ? "Hủy liên kết CRM" : "Unlink CRM"}</button>}
        {crm.selected !== undefined && <div>
          <p>{crm.selected ? `${vi ? "Xác nhận thay liên kết sang" : "Confirm link to"} ${crm.selected.targetType}: ${crm.selected.label ?? crm.selected.targetId}` : vi ? "Xác nhận hủy liên kết CRM?" : "Confirm unlink CRM?"}</p>
          <button type="button" disabled={pending} onClick={() => { void crm.confirm(); }}>{vi ? "Xác nhận CRM" : "Confirm CRM"}</button>
        </div>}
        {pending && <p role="status">{vi ? "Đang lưu liên kết…" : "Saving CRM link…"}</p>}
      </>}
    </>}
    {crm.status === "conflict" || crm.status === "error" || crm.status === "denied" ? <button type="button" onClick={crm.reload}>{vi ? "Tải lại CRM" : "Reload CRM"}</button> : null}
  </section>;
}
