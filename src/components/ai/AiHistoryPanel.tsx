import React from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import type { AiChatThread } from "@/ai";
import { aiFocus } from "./aiPresentation";

export function AiHistoryPanel({ threads, activeId, search, onSearch, onCreate, onSelect, onDelete, connected, locale }: {
  threads: AiChatThread[]; activeId: string | null; search: string; onSearch: (value: string) => void;
  onCreate: () => void; onSelect: (id: string) => void; onDelete: (id: string) => void; connected: boolean; locale: "vi" | "en";
}) {
  const vi = locale === "vi";
  const query = search.trim().toLocaleLowerCase();
  const filtered = threads.filter(thread => !query || `${thread.title} ${thread.messages.map(message => message.content).join(" ")}`.toLocaleLowerCase().includes(query));
  return <div className="flex h-full min-h-0 flex-col bg-slate-50" data-ai-history data-i18n-skip="true">
    <div className="space-y-3 p-4">
      <button type="button" onClick={onCreate} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-800 hover:bg-slate-100 ${aiFocus}`}><Plus size={16} aria-hidden="true" />{vi ? "Cuộc trò chuyện mới" : "New conversation"}</button>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-violet-400"><Search size={15} aria-hidden="true" className="shrink-0 text-slate-400" /><input aria-label={vi ? "Tìm lịch sử" : "Search history"} value={search} onChange={event => onSearch(event.target.value)} placeholder={vi ? "Tìm trong lịch sử…" : "Search conversations…"} className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-700 outline-none" /></label>
    </div>
    <h2 className="px-4 pb-2 text-xs font-medium text-slate-500">{vi ? "Cuộc trò chuyện" : "Conversations"}</h2>
    <div className="min-h-0 flex-1 overflow-y-auto px-2">
      {filtered.map(thread => <div key={thread.id} className="group relative mb-1">
        <button type="button" aria-current={thread.id === activeId ? "true" : undefined} onClick={() => onSelect(thread.id)} className={`w-full rounded-lg px-3 py-2.5 pr-10 text-left ${aiFocus} ${thread.id === activeId ? "bg-violet-50 text-violet-900" : "text-slate-700 hover:bg-slate-100"}`}>
          <span className="break-words text-[13px] font-medium leading-5">{thread.title}</span>
          <time dateTime={thread.updatedAt} className="mt-1 block text-xs text-slate-600">{new Date(thread.updatedAt).toLocaleString(vi ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
        </button>
        <button type="button" onClick={() => onDelete(thread.id)} aria-label={`${vi ? "Xóa cuộc trò chuyện" : "Delete conversation"}: ${thread.title}`} className={`break-words absolute right-1 top-2 flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-rose-700 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 ${aiFocus}`}><Trash2 size={15} aria-hidden="true" /></button>
      </div>)}
      {filtered.length === 0 && <p className="px-3 py-8 text-[13px] leading-6 text-slate-500">{vi ? "Không tìm thấy cuộc trò chuyện." : "No conversations found."}</p>}
    </div>
    <p className="border-t border-slate-200 p-4 text-xs leading-5 text-slate-500">{connected ? (vi ? "Lịch sử trong phiên này. Không được lưu bền vững trên máy chủ." : "History for this session. It is not durably saved on the server.") : (vi ? "Lịch sử Demo được lưu trên trình duyệt theo workspace và người dùng." : "Demo history is stored in this browser per workspace and user.")}</p>
  </div>;
}
