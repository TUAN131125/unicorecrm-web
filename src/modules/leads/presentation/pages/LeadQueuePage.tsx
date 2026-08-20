import { formatApplicationError } from "@/shared/operations";
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Inbox, ShieldAlert, Award, FileText, CheckCircle2, UserPlus, Phone, MessageSquare, Edit3, Check, Zap, HelpCircle, AlertTriangle 
} from "lucide-react";
import type { Lead } from "../../domain/model/lead.types";
import { LeadWorkState, QualificationOutcome } from "../../domain/model/leadLifecycle.canonical";

import { useI18n } from "@/i18n";
import { PageHeader } from "@/shared/components/ui";
import { ListControlBar } from "@/components/crm/ListControlBar";
import { useLeads } from "../hooks/useLeads";
import { useLeadActions } from "../hooks/useLeadActions";
import { buildLeadQueueGroups, filterLeadQueue } from "../../application/queries/leadQueueQueries";
import { getLeadDuplicateCandidates } from "../../application/queries/leadIdentityResolution";
import { LeadDuplicateReviewModal } from "../components/LeadDuplicateReviewModal";
import { notifyProduct, requestDecision } from "@/components/feedback/ProductDialogService";
import { CAPABILITIES } from "@/platform/access-control";
import { evaluateLeadContactPolicy, getLeadContactPolicyMessage, LeadContactChannel } from "../../domain/rules/leadContactPolicy";
import { useRecordOwnershipContext } from "@/platform/record-ownership";

export const LeadQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { leads } = useLeads();
  const leadActions = useLeadActions();
  const ownership = useRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN);
  const [activeCategory, setActiveCategory] = useState<"unassigned" | "hot" | "sla" | "duplicate">("unassigned");
  const [actioningLeadId, setActioningLeadId] = useState<string | null>(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [duplicateReviewLeadId, setDuplicateReviewLeadId] = useState<string | null>(null);

  const queueGroups = useMemo(() => buildLeadQueueGroups(leads), [leads]);
  const { unassigned: unassignedLeads, hot: hotLeads, sla: slaLeads, duplicate: duplicateLeads } = queueGroups;
  const queueLeads = queueGroups[activeCategory];

  const [searchTerm, setSearchTerm] = useState("");
  const filteredQueueLeads = useMemo(
    () => filterLeadQueue(queueLeads, searchTerm),
    [queueLeads, searchTerm],
  );
  const duplicateReviewLead = duplicateReviewLeadId ? leads.find((lead) => lead.id === duplicateReviewLeadId) : undefined;
  const duplicateReviewCandidates = useMemo(
    () => duplicateReviewLead ? getLeadDuplicateCandidates(duplicateReviewLead, leads).map((candidate) => candidate.lead) : [],
    [duplicateReviewLead, leads],
  );

  const handleMergeDuplicates = async (survivorLeadId: string, duplicateLeadIds: string[], reason: string) => {
    if (!ownership?.memberId) throw new Error("LEAD_DUPLICATE_REVIEW_ACTOR_REQUIRED");
    await leadActions.mergeDuplicates({ survivorLeadId, duplicateLeadIds, reason, actorId: ownership.memberId, actorName: ownership.displayName });
    notifyProduct(locale === "vi" ? "Đã gộp Lead và bảo toàn lịch sử nguồn." : "Leads were merged with source lineage preserved.", "success");
  };

  const handleConfirmDistinct = async (candidateLeadIds: string[], reason: string) => {
    if (!duplicateReviewLead || !ownership?.memberId) throw new Error("LEAD_DUPLICATE_REVIEW_ACTOR_REQUIRED");
    await leadActions.confirmDuplicatesDistinct({ leadId: duplicateReviewLead.id, candidateLeadIds, reason, actorId: ownership.memberId });
    notifyProduct(locale === "vi" ? "Đã xác nhận các Lead là những hồ sơ khác nhau." : "The Leads were confirmed as distinct records.", "success");
  };

  // Quick actions remain UI-orchestrated; mutations execute through application commands.
  const handleAssignToMe = async (leadId: string) => {
    if (!ownership?.memberId) {
      notifyProduct(locale === "vi" ? "Không xác định được tài khoản đang đăng nhập." : "The signed-in account could not be resolved.", "danger");
      return;
    }
    try {
      await leadActions.claimFromQueue(
        leadId,
        locale === "vi" ? "Nhận xử lý từ hàng đợi Lead" : "Claimed from the Lead queue",
      );
      notifyProduct(t("leadQueue.assignedAlert"), "success");
    } catch (error) {
      notifyProduct(formatApplicationError(error, { locale }), "warning");
    }
  };

  const handleMarkContacted = async (leadId: string) => {
    try {
      await leadActions.changeWorkState(leadId, LeadWorkState.CONTACTING, {
      id: `act_contact_${Date.now()}`,
      icon: "check",
      title: t("leadQueue.activities.markedContactedTitle"),
      description: t("leadQueue.activities.markedContactedDescription"),
      createdAt: t("common.justNow"),
      author: t("common.system"),
        type: "system",
      });
    } catch (error) {
      notifyProduct(formatApplicationError(error, { locale }), "warning");
    }
  };

  const handleQuickCall = async (leadId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return;
    const decision = evaluateLeadContactPolicy(lead, LeadContactChannel.CALL);
    if (!decision.allowed) {
      notifyProduct(getLeadContactPolicyMessage(decision.reason, locale), "warning");
      return;
    }
    notifyProduct(t("leadQueue.callAlert"), "info");
    await leadActions.appendActivity(leadId, {
      id: `act_qcall_${Date.now()}`,
      icon: "call",
      title: t("leadQueue.outboundQueueCall"),
      description: t("leadQueue.outboundQueueCallDesc"),
      createdAt: t("leadQueue.justNow"),
      author: t("leadQueue.youTitle"),
      type: "call",
    });
  };

  const handleSaveQuickNote = async (leadId: string) => {
    if (!quickNoteText.trim()) return;
    await leadActions.appendActivity(leadId, {
      id: `act_qnote_${Date.now()}`,
      icon: "edit_note",
      title: t("leadQueue.quickNote"),
      description: quickNoteText,
      createdAt: t("leadQueue.justNow"),
      author: t("leadQueue.youTitle"),
      type: "note",
    });
    setQuickNoteText("");
    setActioningLeadId(null);
    notifyProduct(t("leadQueue.noteSavedAlert"), "success");
  };

  const handleQualifyLead = async (leadId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return;
    if (lead.leadWorkState !== LeadWorkState.CONTACTING) {
      await requestDecision({
        title: locale === "vi" ? "Chưa thể bắt đầu xác minh" : "Verification cannot start yet",
        message: locale === "vi" ? "Khách hàng tiềm năng phải ở bước Đang liên hệ trước khi chuyển sang Xác minh. Hãy cập nhật trạng thái liên hệ trước." : "The lead must be in Contacting before moving to Verifying. Update the contact status first.",
        tone: "warning",
        actions: [{ id: "back", label: locale === "vi" ? "Quay lại" : "Go back", variant: "secondary" }],
      });
      return;
    }

    try {
      await leadActions.changeWorkState(leadId, LeadWorkState.VERIFYING, {
      id: `act_qualify_${Date.now()}`,
      icon: "check_circle",
      title: t("leadQueue.activities.markedQualifiedTitle"),
      description: t("leadQueue.activities.markedQualifiedDescription"),
      createdAt: t("common.justNow"),
      author: t("common.system"),
        type: "system",
      });
      notifyProduct(locale === "vi" ? "Khách hàng tiềm năng đã chuyển sang bước Đang xác minh." : "The lead moved to Verifying.", "success");
    } catch (error) {
      notifyProduct(formatApplicationError(error, { locale }), "warning");
    }
  };

  return (
    <div id="lead-queue-page" className="space-y-4">
      
      {/* Header */}
      <PageHeader
        title={t("leadQueue.title")}
        icon={<Inbox size={18} />}
      />

      {/* Queue Categories selector layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        
        {/* Unassigned */}
        <button
          onClick={() => { setActiveCategory("unassigned"); setActioningLeadId(null); }}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeCategory === "unassigned" 
              ? "bg-white border-indigo-500 ring-1 ring-indigo-500 shadow" 
              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Inbox size={15} className="text-indigo-600" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t("leadQueue.unassigned")}</span>
          </div>
          <p className="text-lg font-extrabold text-slate-900">{unassignedLeads.length} Lead</p>
          <span className="text-[10px] text-slate-400">{t("leadQueue.autoRoute")}</span>
        </button>

        {/* Hot Leads */}
        <button
          onClick={() => { setActiveCategory("hot"); setActioningLeadId(null); }}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeCategory === "hot" 
              ? "bg-white border-indigo-500 ring-1 ring-indigo-500 shadow" 
              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Award size={15} className="text-amber-500" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t("leadQueue.hot")}</span>
          </div>
          <p className="text-lg font-extrabold text-slate-900">{hotLeads.length} Lead</p>
          <span className="text-[10px] text-emerald-600 font-semibold">{t("leadQueue.score80")}</span>
        </button>

        {/* SLA response warning */}
        <button
          onClick={() => { setActiveCategory("sla"); setActioningLeadId(null); }}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeCategory === "sla" 
              ? "bg-white border-indigo-500 ring-1 ring-indigo-500 shadow" 
              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap size={15} className="text-red-500" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t("leadQueue.slaSla")}</span>
          </div>
          <p className="text-lg font-extrabold text-slate-900">{slaLeads.length} Lead</p>
          <span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
            <AlertTriangle size={10} /> {t("leadQueue.slaOver24h")}
          </span>
        </button>

        {/* Possible duplicates */}
        <button
          onClick={() => { setActiveCategory("duplicate"); setActioningLeadId(null); }}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeCategory === "duplicate" 
              ? "bg-white border-indigo-500 ring-1 ring-indigo-500 shadow" 
              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={15} className="text-slate-600" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t("leadQueue.duplicate")}</span>
          </div>
          <p className="text-lg font-extrabold text-slate-900">{duplicateLeads.length} Lead</p>
          <span className="text-[10px] text-amber-600 font-semibold">{t("leadQueue.duplicatePhoneAttr")}</span>
        </button>

      </div>

      {/* List Control Bar */}
      <ListControlBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={
          activeCategory === "unassigned" ? (locale === "vi" ? "Tìm kiếm Lead chưa phân công..." : "Search unassigned Leads...") :
          activeCategory === "hot" ? (locale === "vi" ? "Tìm kiếm Hot Lead..." : "Search Hot Leads...") :
          activeCategory === "sla" ? (locale === "vi" ? "Tìm kiếm Lead quá hạn SLA..." : "Search SLA Leads...") :
          (locale === "vi" ? "Tìm kiếm Lead trùng lặp..." : "Search duplicate Leads...")
        }
        rightSlot={
          <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200 text-xs font-bold leading-none font-sans select-none shrink-0 self-center">
            <span className="px-3.5 py-1.5 text-slate-500 uppercase tracking-wide text-[10px] self-center">
              {locale === "vi" ? "Đang xem" : "Viewing"}:
            </span>
            <span className="bg-white text-indigo-700 shadow-xs rounded-lg px-3 py-1.5 text-[10px] uppercase font-black tracking-wide self-center mr-0.5">
              {activeCategory}
            </span>
          </div>
        }
      />

      {/* Main Queue Content cards */}
      <div className="space-y-3">
        {filteredQueueLeads.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-indigo-400" />
            <p className="text-xs font-bold text-slate-700">{t("leadQueue.emptyQueue")}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              {t("leadQueue.salesTeamMessage")}
            </p>
          </div>
        ) : (
          filteredQueueLeads.map(lead => {
            const isNotePanelOpen = actioningLeadId === lead.id;
            return (
              <div 
                key={lead.id} 
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
              >
                
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span 
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className="text-xs font-extrabold text-slate-900 hover:text-indigo-600 hover:underline cursor-pointer"
                    >
                      {lead.name}
                    </span>
                    <span className="text-slate-300">•</span>
                    {lead.score >= 80 && (
                      <span className="bg-red-100 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded">🔴 HOT</span>
                    )}

                    {slaLeads.some(s => s.id === lead.id) && (
                      <span className="bg-rose-100 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded">⚠️ {t("leadQueue.lateSlaBadge")}</span>
                    )}

                    {duplicateLeads.some(d => d.id === lead.id) && (
                      <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded">⚠️ {t("leadQueue.duplicatePhoneBadge")}</span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium">{t("leadQueue.requestNote")} <span className="text-slate-800">{lead.notes || t("leadQueue.noAdditionalNotes")}</span></p>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium pt-1">
                    <span>{t("leadQueue.columnSource")}: {lead.source}</span>
                    <span>•</span>
                    <span>{t("leadQueue.createdAtLabel")}: {new Date(lead.createdAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</span>
                  </div>

                  {/* Expand note section */}
                  {isNotePanelOpen && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 mt-2"
                    >
                      <label className="text-[10px] text-slate-500 font-bold block">{t("leadQueue.quickNoteDiscussion")}</label>
                      <textarea
                        rows={2}
                        value={quickNoteText}
                        onChange={(e) => setQuickNoteText(e.target.value)}
                        placeholder={t("leadQueue.quickNotePlaceholder")}
                        className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => setActioningLeadId(null)}
                          className="bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded text-[10px]"
                        >
                          {t("leadQueue.cancel")}
                        </button>
                        <button 
                          onClick={() => handleSaveQuickNote(lead.id)}
                          className="bg-indigo-600 text-white font-bold px-2.5 py-1 rounded text-[10px]"
                        >
                          {t("leadQueue.save")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Actions Workbench */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  
                  {(!lead.ownerId || lead.ownerId === "unassigned") && (
                    <button
                      id={`action-assign-${lead.id}`}
                      onClick={() => handleAssignToMe(lead.id)}
                      className="bg-slate-100 hover:bg-slate-200 text-indigo-700 border border-indigo-200 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title={t("leadQueue.claimLead")}
                    >
                      <UserPlus size={13} />
                      <span>{t("leadQueue.claimLead")}</span>
                    </button>
                  )}

                  {duplicateLeads.some((candidate) => candidate.id === lead.id) && (
                    <button
                      id={`action-review-duplicate-${lead.id}`}
                      onClick={() => setDuplicateReviewLeadId(lead.id)}
                      className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                    >
                      {locale === "vi" ? "Rà soát trùng" : "Review duplicate"}
                    </button>
                  )}

                  <button
                    id={`action-call-${lead.id}`}
                    onClick={() => handleQuickCall(lead.id)}
                    className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs p-2 rounded-lg cursor-pointer"
                    title={t("leadQueue.executeCallBtn")}
                  >
                    <Phone size={13} className="text-slate-500" />
                  </button>

                  <button
                    id={`action-note-${lead.id}`}
                    onClick={() => setActioningLeadId(isNotePanelOpen ? null : lead.id)}
                    className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs p-2 rounded-lg cursor-pointer"
                    title={t("leadQueue.quickNoteBtn")}
                  >
                    <Edit3 size={13} className="text-slate-400" />
                  </button>

                  {lead.leadWorkState === LeadWorkState.NEW && lead.ownerId && lead.ownerId !== "unassigned" && (
                    <button
                      id={`action-contact-${lead.id}`}
                      onClick={() => handleMarkContacted(lead.id)}
                      className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                    >
                      {t("leadQueue.actions.markContacted")}
                    </button>
                  )}

                  {lead.leadWorkState === LeadWorkState.CONTACTING && (
                    <button
                      id={`action-qualify-${lead.id}`}
                      onClick={() => handleQualifyLead(lead.id)}
                      className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                    >
                      {locale === "vi" ? "Bắt đầu xác minh" : "Start verifying"}
                    </button>
                  )}

                  {lead.leadWorkState === LeadWorkState.VERIFYING && (
                    <button
                      id={`action-resolve-outcome-${lead.id}`}
                      onClick={() => navigate(`/leads/${lead.id}/qualify`)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm cursor-pointer animate-pulse"
                    >
                      {locale === "vi" ? "Chốt kết quả" : "Resolve outcome"}
                    </button>
                  )}

                </div>

              </div>
            );
          })
        )}
      </div>

      <LeadDuplicateReviewModal
        isOpen={Boolean(duplicateReviewLead)}
        lead={duplicateReviewLead}
        candidates={duplicateReviewCandidates}
        onClose={() => setDuplicateReviewLeadId(null)}
        onMerge={handleMergeDuplicates}
        onConfirmDistinct={handleConfirmDistinct}
      />

    </div>
  );
};
