import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../src/index.css";
import { I18nProvider } from "@/i18n";
import { signIn } from "@/platform/identity-auth";
import { initializeApplicationComposition } from "@/app/composition";
import { replaceDeals, replaceDealStages } from "@/modules/deals/public/deals";
import { DEFAULT_DEAL_STAGES } from "@/modules/deals/domain/rules/dealStages";
import { DealStage, type Deal, type OpportunityStageConfig } from "@/modules/deals/domain/model/deal.types";
import { replaceQuotes, QuoteStatus, type Quote } from "@/modules/quotes";
import { getContactsSnapshot } from "@/modules/contacts";
import { DealDetailPage } from "@/modules/deals/presentation/pages/DealDetailPage";
import { loadAccessGovernance } from "@/platform/access-control";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";

// Standalone presentation-only test entry. Never imported by the application, no HTTP Backend.
signIn({ email: "admin@unicorecrm.local", password: "admin123" });
await initializeApplicationComposition({ mode: "demo" });
await loadAccessGovernance(getWorkspaceContextSnapshot().workspaceId);
const params = new URLSearchParams(location.search);
const scenario = params.get("pipeline") ?? "default";
let stages: OpportunityStageConfig[] = structuredClone(DEFAULT_DEAL_STAGES);
if (scenario === "few") stages = stages.map(stage => ({ ...stage, isActive: stage.category !== "open" || ["DISCOVERY", "PROPOSAL", "NEGOTIATION"].includes(stage.code) }));
if (["many", "long", "custom"].includes(scenario)) stages.push(...["ANALYSIS", "REVIEW", "APPROVAL"].map((code, index) => ({ ...DEFAULT_DEAL_STAGES[0], id: `visual-${code}`, code,
  labelVi: scenario === "long" ? `Đánh giá yêu cầu tích hợp và kế hoạch triển khai nhiều chi nhánh ${index + 1}` : `Giai đoạn tùy chỉnh ${index + 1}`, labelEn: `Custom review ${index + 1}`, order: 25 + index * 10, isSystem: false })));
if (scenario === "inactive") stages = stages.map(stage => stage.code === "QUALIFIED" ? { ...stage, isActive: false } : stage);
if (scenario === "reordered") stages = stages.map(stage => ({ ...stage, order: -stage.order }));
replaceDealStages(stages);
const buyerId = getContactsSnapshot()[0]?.id ?? "fixture-buyer";
const deal: Deal = { id: "visual-deal", name: "Triển khai CRM cho chuỗi cửa hàng Minh Phúc", buyerRef: { type: "CONTACT", id: buyerId },
  stage: scenario === "won" ? DealStage.WON : scenario === "lost" ? DealStage.LOST : scenario === "custom" ? "REVIEW" : scenario === "few" ? DealStage.PROPOSAL : DealStage.QUALIFIED,
  amount: 1036000000, amountDecimal: "1036000000", currency: "VND", opportunityScore: 65, ownerId: "u1", expectedCloseDate: "2026-12-20", createdAt: "2026-10-01T02:00:00Z", updatedAt: "2026-10-23T02:00:00Z",
  interestedProducts: [], lineItems: [], notes: "Khảo sát nhu cầu tại các điểm bán. Ưu tiên thống nhất quy trình tiếp nhận khách hàng trước khi triển khai.",
  nextActionSummary: "Trao đổi phạm vi triển khai và lịch demo", nextActionAt: "2026-10-26T02:00:00Z",
  ...(scenario === "won" ? { winEvidence: { type: "QUOTE_ACCEPTED" as const, sourceId: "visual-quote", occurredAt: "2026-10-22T02:00:00Z" } } : {}),
  ...(scenario === "lost" ? { lostReason: "NO_BUDGET", recycleDecision: "RECYCLE" as const, revisitAt: "2026-12-01T02:00:00Z" } : {}) };
replaceDeals([deal]);
const requested = params.get("quote") ?? "none";
const quoteStatus = Object.values(QuoteStatus).find(status => status === requested);
const quote: Quote = { id: "visual-quote", quoteNumber: "BG-VISUAL-014", version: 1, rootQuoteId: "visual-quote", buyerRef: deal.buyerRef, sourcePath: "DEAL", sourceDealId: deal.id, dealId: deal.id,
  title: "Báo giá tư vấn và triển khai CRM", status: quoteStatus ?? QuoteStatus.DRAFT, currency: "USD", grandTotal: 12500.5, subtotal: 12500.5, lineItems: [], createdAt: "2026-10-18T02:00:00Z", validUntil: "2026-11-30" };
replaceQuotes(requested === "none" ? [] : requested === "multiple" ? [quote, { ...quote, id: "visual-quote-second", rootQuoteId: "visual-quote-second", quoteNumber: "BG-VISUAL-015", status: QuoteStatus.SENT }] : [quote]);
const root = document.getElementById("root");
if (!root) throw new Error("Fixture root missing");
createRoot(root).render(<I18nProvider><div className="min-h-screen bg-slate-50 p-4 sm:p-6"><p className="mx-auto mb-4 max-w-7xl text-xs font-semibold text-amber-800" data-presentation-fixture>Presentation fixture · No Connected Backend · {scenario} / {requested}</p><MemoryRouter initialEntries={["/deals/visual-deal"]}><Routes><Route path="/deals/:dealId" element={<DealDetailPage customers={[]} setCustomers={() => {}} contacts={[]} />} /></Routes></MemoryRouter></div></I18nProvider>);
