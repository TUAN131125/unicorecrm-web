import React from "react";
import { CheckCircle2, KeyRound, Play, Power, Save } from "lucide-react";
import { useI18n } from "@/i18n";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { presentAiProviderFailure } from "@/ai";
import { normalizeApplicationError } from "@/shared/domain";
import type { AiConfiguration, AiConfigurationDraft, AiProviderEntry, AiUsageSummary } from "../../application/AiConfigurationGateway";
import { activateAiConfiguration, disableAiConfiguration, loadAiConfiguration, loadAiProviderCatalog, loadAiUsageSummary, saveAiConfiguration, setAiCredential, testAiConfiguration } from "../../application/composition/aiConfigurationApplicationServices";
import { StudioButton, StudioPageFrame, StudioSection } from "../components/StudioPrimitives";
import { AiModelSelect } from "../components/AiModelSelect";

export function AiConfigurationView() {
  const workspace = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  return <AiConfigurationEditor key={`${workspace.workspaceId}:${access.accountId}`} />;
}

function AiConfigurationEditor() {
  const { locale } = useI18n(); const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const canManage = useEffectiveAccess().can(CAPABILITIES.AI_CONFIGURATION_MANAGE);
  const [catalog, setCatalog] = React.useState<AiProviderEntry[]>([]); const [configuration, setConfiguration] = React.useState<AiConfiguration>();
  const [usage, setUsage] = React.useState<AiUsageSummary>();
  const [draft, setDraft] = React.useState<AiConfigurationDraft>(); const [credential, setCredentialValue] = React.useState("");
  const [fallbackCredential, setFallbackCredential] = React.useState(""); const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState(""); const [error, setError] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const mutationInFlight = React.useRef(false);
  React.useEffect(() => setCredentialValue(""), [draft?.primaryProvider]);
  React.useEffect(() => setFallbackCredential(""), [draft?.fallbackProvider]);

  React.useEffect(() => { const controller = new AbortController(); void Promise.all([loadAiProviderCatalog(controller.signal), loadAiConfiguration(controller.signal), loadAiUsageSummary(controller.signal)])
    .then(([providers, value, summary]) => { setCatalog(providers); setUsage(summary); commit(value); }).catch((cause) => { if (!controller.signal.aborted) setError(safeError(cause, locale, text)); }); return () => controller.abort(); }, []);
  const commit = (value: AiConfiguration) => { setConfiguration(value); setDraft(configurationDraft(value)); };
  const run = async (action: () => Promise<AiConfiguration>, success: string, isTest = false) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true; setBusy(true); setTesting(isTest); setError(""); setMessage("");
    try { commit(await action()); setMessage(success); }
    catch (cause) {
      const failure = safeError(cause, locale, text); setError(failure);
      if (isTest) {
        try { commit(await loadAiConfiguration()); }
        catch { setError(`${failure} ${text("Không thể tải lại trạng thái cấu hình. Hãy làm mới trang trước khi tiếp tục.", "Configuration status could not be reloaded. Refresh the page before continuing.")}`); }
      }
    } finally { mutationInFlight.current = false; setTesting(false); setBusy(false); }
  };
  if (!configuration || !draft) return <div className="p-8 text-sm text-slate-500">{error || text("Đang tải cấu hình AI…", "Loading AI configuration…")}</div>;
  const primary = catalog.find((item) => item.id === draft.primaryProvider); const fallback = catalog.find((item) => item.id === draft.fallbackProvider);
  const editableCredentialState = configuration.pendingDraft ?? configuration;
  const savedDraft = configurationDraft(configuration);
  const hasUnsavedChanges = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const hasPendingCredential = (draft.primaryCredentialSource === "WORKSPACE" && credential.length > 0)
    || (draft.fallbackEnabled && draft.fallbackCredentialSource === "WORKSPACE" && fallbackCredential.length > 0);
  const draftValidated = configuration.pendingDraft?.isValidated ?? (configuration.status !== "ACTIVE" && configuration.isValidated);
  const selectClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500";
  return <StudioPageFrame title={text("Trợ lý AI", "AI Assistant")} description={text("Cấu hình nhà cung cấp phía máy chủ. Chat không thể thay đổi nhà cung cấp, model hoặc thông tin xác thực.", "Configure server-side providers. Chat cannot override the provider, model, or credential.")} locale={locale} revision={configuration.version} updatedAt={configuration.updatedAt} error={error} message={message}
    actions={canManage ? <StudioButton tone="primary" icon={<Save size={15}/>} loading={busy && !testing} disabled={busy} onClick={() => void run(() => saveAiConfiguration(draft, configuration.version), text("Đã lưu bản nháp.", "Draft saved."))}>{text("Lưu bản nháp", "Save draft")}</StudioButton> : undefined}>
    <div className="grid gap-5 xl:grid-cols-2">
      <StudioSection title={text("Nhà cung cấp chính", "Primary provider")} description={`${text("Trạng thái đang hoạt động", "Active status")}: ${configuration.status}`}>
        {configuration.status === "ACTIVE" ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm" data-ai-active-configuration="true"><strong>{text("Đang hoạt động", "Active")}</strong>: {configuration.primaryProvider} / {configuration.primaryModel}</div> : null}
        {configuration.pendingDraft ? <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm" data-ai-pending-configuration="true"><strong>{text("Bản nháp chờ kích hoạt", "Pending draft")}</strong>: {configuration.pendingDraft.primaryProvider} / {configuration.pendingDraft.primaryModel}</div> : null}
        <div className="space-y-4"><label className="block text-sm font-medium">{text("Nhà cung cấp", "Provider")}<select className={`${selectClass} mt-1`} disabled={!canManage || busy} value={draft.primaryProvider} onChange={(event) => { const provider = event.target.value as "GEMINI"|"OPENAI"; const entry = catalog.find((item) => item.id === provider); const model = entry?.models[0]; if (!model) return; const fallbackCandidate = draft.fallbackEnabled && draft.fallbackProvider === provider ? catalog.find((item) => item.id !== provider) : undefined; const fallbackModel = fallbackCandidate?.models[0]; setDraft({ ...draft, primaryProvider: provider, primaryModel: model.id, ...(fallbackCandidate && fallbackModel ? { fallbackProvider: fallbackCandidate.id, fallbackModel: fallbackModel.id } : {}) }); }}>{catalog.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        {draft.primaryProvider === "OPENAI" ? <AiModelSelect models={primary?.models} value={draft.primaryModel} disabled={!canManage || busy} locale={locale} onChange={(primaryModel) => setDraft({ ...draft, primaryModel })} /> : <label className="block text-sm font-medium">Model<select className={`${selectClass} mt-1`} disabled={!canManage || busy} value={draft.primaryModel} onChange={(event) => setDraft({ ...draft, primaryModel: event.target.value })}>{primary?.models.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}</select></label>}
        {draft.primaryProvider === "GEMINI" && draft.primaryModel.startsWith("gemini-2.5-") ? <p className="text-sm text-amber-700">{text("Google giới hạn Gemini 2.5 cho người đã dùng trước đây. Với dự án mới, hãy chọn Gemini 3.8 Flash rồi lưu và kiểm tra lại.", "Google limits Gemini 2.5 access to existing users. For a new project, choose Gemini 3.8 Flash, then save and test again.")}</p> : null}
        <label className="block text-sm font-medium">{text("Nguồn thông tin xác thực", "Credential source")}<select className={`${selectClass} mt-1`} disabled={!canManage || busy} value={draft.primaryCredentialSource} onChange={(event) => setDraft({ ...draft, primaryCredentialSource: event.target.value as "WORKSPACE"|"DEPLOYMENT" })}><option value="DEPLOYMENT">Deployment</option><option value="WORKSPACE">Workspace</option></select></label>
        {canManage && draft.primaryCredentialSource === "WORKSPACE" ? <div><label className="block text-sm font-medium">{text("Khóa API", "API key")}<input type="password" autoComplete="new-password" className={`${selectClass} mt-1`} value={credential} onChange={(event) => setCredentialValue(event.target.value)} /></label><StudioButton icon={<KeyRound size={14}/>} disabled={!credential || busy || hasUnsavedChanges} onClick={() => void run(async () => { const value = await setAiCredential(credential, false, configuration.version); setCredentialValue(""); return value; }, text("Đã cập nhật thông tin xác thực.", "Credential updated."))}>{editableCredentialState.primaryCredentialConfigured ? text("Xoay vòng khóa", "Rotate key") : text("Đặt khóa", "Set key")}</StudioButton></div> : null}</div>
      </StudioSection>
      <StudioSection title={text("Dự phòng có kiểm soát", "Controlled fallback")} description={text("Tắt mặc định; khi bật, context AI an toàn có thể được gửi tới nhà cung cấp thứ hai.", "Off by default; enabling permits safe AI context to be sent to the second provider.")}>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canManage || busy} checked={draft.fallbackEnabled} onChange={(event) => { const enabled = event.target.checked; const candidate = catalog.find((item) => item.id !== draft.primaryProvider); setDraft({ ...draft, fallbackEnabled: enabled, fallbackProvider: enabled ? candidate?.id : null, fallbackModel: enabled ? candidate?.models[0]?.id : null, fallbackCredentialSource: enabled ? "DEPLOYMENT" : null }); }}/>{text("Bật failover chéo nhà cung cấp", "Enable cross-provider failover")}</label>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" disabled={!canManage || busy} checked={draft.retryRateLimited} onChange={(event) => setDraft({ ...draft, retryRateLimited: event.target.checked })}/><span>{text("Cho phép thử lại và chuyển sang nhà cung cấp dự phòng khi nhà cung cấp trả về giới hạn 429.", "Allow retry and cross-provider failover when the provider returns rate limit 429.")}</span></label>
        {draft.fallbackEnabled ? <div className="mt-4 space-y-4"><label className="block text-sm font-medium">{text("Nhà cung cấp dự phòng", "Fallback provider")}<select className={`${selectClass} mt-1`} disabled={!canManage || busy} value={draft.fallbackProvider ?? ""} onChange={(event) => { const provider = event.target.value as "GEMINI"|"OPENAI"; const model = catalog.find((item) => item.id === provider)?.models[0]; if (model) setDraft({ ...draft, fallbackProvider: provider, fallbackModel: model.id }); }}>{catalog.filter((item) => item.id !== draft.primaryProvider).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>{draft.fallbackProvider === "OPENAI" ? <AiModelSelect models={fallback?.models} value={draft.fallbackModel ?? ""} disabled={!canManage || busy} locale={locale} onChange={(fallbackModel) => setDraft({ ...draft, fallbackModel })} /> : <label className="block text-sm font-medium">Model<select className={`${selectClass} mt-1`} disabled={!canManage || busy} value={draft.fallbackModel ?? ""} onChange={(event) => setDraft({ ...draft, fallbackModel: event.target.value })}>{fallback?.models.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}</select></label>}<label className="block text-sm font-medium">{text("Nguồn thông tin xác thực", "Credential source")}<select className={`${selectClass} mt-1`} disabled={!canManage || busy} value={draft.fallbackCredentialSource ?? "DEPLOYMENT"} onChange={(event) => setDraft({ ...draft, fallbackCredentialSource: event.target.value as "WORKSPACE"|"DEPLOYMENT" })}><option value="DEPLOYMENT">Deployment</option><option value="WORKSPACE">Workspace</option></select></label>{canManage && draft.fallbackCredentialSource === "WORKSPACE" ? <div><label className="block text-sm font-medium">{text("Khóa API", "API key")}<input type="password" autoComplete="new-password" className={`${selectClass} mt-1`} value={fallbackCredential} onChange={(event) => setFallbackCredential(event.target.value)} /></label><StudioButton icon={<KeyRound size={14}/>} disabled={!fallbackCredential || busy || hasUnsavedChanges} onClick={() => void run(async () => { const value = await setAiCredential(fallbackCredential, true, configuration.version); setFallbackCredential(""); return value; }, text("Đã cập nhật khóa dự phòng.", "Fallback credential updated."))}>{editableCredentialState.fallbackCredentialConfigured ? text("Xoay vòng khóa", "Rotate key") : text("Đặt khóa", "Set key")}</StudioButton></div> : null}</div> : null}
      </StudioSection>
    </div>
    <StudioSection className="mt-5" title={text("Xác minh và kích hoạt", "Validate and activate")} description={text("Kiểm tra dùng dữ liệu tổng hợp, không gửi bản ghi CRM.", "Connection tests use synthetic input and do not send CRM records.")} actions={canManage ? <div className="flex gap-2"><StudioButton icon={<Play size={14}/>} loading={testing} disabled={busy || hasUnsavedChanges || hasPendingCredential} onClick={() => void run(() => testAiConfiguration(configuration.version), text("Kiểm tra kết nối thành công.", "Connection test passed."), true)}>{text("Kiểm tra", "Test")}</StudioButton><StudioButton tone="primary" icon={<CheckCircle2 size={14}/>} disabled={busy || hasUnsavedChanges || hasPendingCredential || !draftValidated} onClick={() => void run(() => activateAiConfiguration(configuration.version), text("Đã kích hoạt cấu hình AI.", "AI configuration activated."))}>{text("Kích hoạt", "Activate")}</StudioButton><StudioButton tone="danger" icon={<Power size={14}/>} disabled={busy || configuration.status !== "ACTIVE"} onClick={() => void run(() => disableAiConfiguration(configuration.version), text("Đã tắt cấu hình AI.", "AI configuration disabled."))}>{text("Tắt", "Disable")}</StudioButton></div> : undefined}>
      <p className="mb-2 text-sm text-slate-600" data-ai-credential-configured={String(draft.primaryCredentialSource === "WORKSPACE" ? editableCredentialState.primaryCredentialConfigured : primary?.deploymentCredentialAvailable ?? false)}>{draft.primaryCredentialSource === "WORKSPACE" ? editableCredentialState.primaryCredentialConfigured ? text("Máy chủ đã ghi nhận API key của bản nháp. Cần kiểm tra để xác minh kết nối.", "The server has recorded the draft API key. Test to verify connectivity.") : text("Bản nháp chưa có API key được lưu trên máy chủ.", "The draft has no API key saved on the server.") : text("Khóa Deployment do máy chủ quản lý. Kiểm tra kết nối để xác minh.", "The deployment key is managed by the server. Test to verify connectivity.")}</p>
      <p className="text-sm text-slate-600">{hasUnsavedChanges ? text("Hãy lưu bản nháp trước khi đặt khóa, kiểm tra hoặc kích hoạt.", "Save the draft before setting a key, testing, or activating.") : hasPendingCredential ? text("Khóa vừa nhập chưa được lưu. Hãy bấm Đặt khóa hoặc Xoay vòng khóa trước khi kiểm tra.", "The entered key has not been saved. Select Set key or Rotate key before testing.") : draftValidated ? text("Bản nháp đã được xác minh.", "Draft is validated.") : text("Bản nháp chưa được xác minh.", "Draft is not validated.")}</p>
      {usage ? <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt className="text-slate-500">{text("Lượt chạy (30 ngày)", "Executions (30 days)")}</dt><dd className="font-semibold">{usage.executions}</dd></div><div><dt className="text-slate-500">{text("Thành công", "Successful")}</dt><dd className="font-semibold">{usage.successfulExecutions}</dd></div><div><dt className="text-slate-500">{text("Lần gọi provider", "Provider attempts")}</dt><dd className="font-semibold">{usage.providerAttempts}</dd></div><div><dt className="text-slate-500">Tokens</dt><dd className="font-semibold">{usage.inputTokens + usage.outputTokens}</dd></div></dl> : null}
    </StudioSection>
  </StudioPageFrame>;
}

function safeError(cause: unknown, locale: "vi" | "en", text: (vi: string, en: string) => string): string {
  const providerFailure = presentAiProviderFailure(cause, locale, "ADMIN");
  if (providerFailure) return providerFailure;
  const normalized = normalizeApplicationError(cause);
  const code = normalized.code;
  if (code.includes("ACCESS_DENIED")) return text("Bạn không có quyền quản lý cấu hình AI.", "You do not have permission to manage AI configuration.");
  if (code.includes("VERSION_CONFLICT")) return text("Cấu hình đã thay đổi. Hãy tải lại.", "Configuration changed. Reload and try again.");
  if (code.includes("RATE_LIMITED")) return text("Đã hết quota hoặc nhà cung cấp đang giới hạn lưu lượng. Hãy kiểm tra hạn mức của dự án trước khi thử lại.", "Provider quota is exhausted or requests are rate limited. Check project limits before trying again.");
  if (code === "REQUEST_TIMEOUT") return text("Hết thời gian chờ máy chủ. Hãy tải lại trạng thái cấu hình trước khi kiểm tra lại.", "The server request timed out. Reload configuration status before testing again.");
  if (code === "REQUEST_CANCELLED") return text("Yêu cầu đã bị hủy. Chưa có kết quả kiểm tra mới; hãy tải lại trạng thái cấu hình.", "The request was cancelled. There is no new test result; reload configuration status.");
  if (code === "AI_PROVIDER_TIMEOUT") return text("Nhà cung cấp phản hồi quá thời gian cho phép.", "The provider request timed out.");
  if (code === "AI_PROVIDER_UNAVAILABLE") return text("Không kết nối được nhà cung cấp AI. Hãy thử lại sau.", "The AI provider is unavailable. Try again later.");
  if (code === "AI_PROVIDER_RESPONSE_INVALID") return text("Nhà cung cấp trả về nội dung không hợp lệ.", "The provider returned an invalid response.");
  if (code === "AI_CONFIGURATION_NOT_VALIDATED") return text("Hãy kiểm tra cấu hình trước khi kích hoạt.", "Test the configuration before activation.");
  if (code === "AI_REQUEST_INVALID" && (normalized.fieldErrors?.primaryModel || normalized.fieldErrors?.fallbackModel)) return text("Nhà cung cấp hoặc model chưa được hệ thống hỗ trợ. Hãy chọn lại model và lưu bản nháp.", "The provider or model is not supported by the system. Choose a model again and save the draft.");
  if (code === "AI_REQUEST_INVALID") return text("Cấu hình hoặc dữ liệu gửi lên không hợp lệ. Hãy kiểm tra model, nguồn khóa và lưu lại bản nháp.", "The configuration or request is invalid. Check the model and credential source, then save the draft again.");
  if (code === "AI_IDEMPOTENCY_KEY_REUSED") return text("Thao tác cấu hình bị trùng. Hãy tải lại cấu hình trước khi thử lại.", "The configuration operation conflicts with an earlier request. Reload before trying again.");
  if (code === "AI_PROVIDER_SAFETY_REFUSAL") return text("Nhà cung cấp từ chối yêu cầu kiểm tra theo chính sách an toàn.", "The provider refused the test under its safety policy.");
  return text("Không thể hoàn tất thao tác cấu hình AI.", "The AI configuration operation could not be completed.");
}

function configurationDraft(value: AiConfiguration): AiConfigurationDraft {
  const editable = value.pendingDraft ?? value;
  return { primaryProvider: editable.primaryProvider, primaryModel: editable.primaryModel,
    primaryCredentialSource: editable.primaryCredentialSource, fallbackEnabled: editable.fallbackEnabled,
    fallbackProvider: editable.fallbackProvider, fallbackModel: editable.fallbackModel,
    fallbackCredentialSource: editable.fallbackCredentialSource, retryRateLimited: editable.retryRateLimited };
}
