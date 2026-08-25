import React from "react";
import { Building2, Globe2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApplicationHttpClient } from "@/app/composition";
import { useI18n } from "@/i18n";
import { productSpaceHome, ROUTE_KEYS } from "@/platform/navigation";
import { ApiClientError } from "@/platform/api/errors/ApiClientError";
import {
  createProvisioningIdempotencyKey,
  toProvisioningRequest,
  WorkspaceProvisioningApiClient,
  type ProvisionInitialWorkspaceRequest,
} from "@/platform/api/extensions/workspaceProvisioningApi";
import {
  enterWorkspace,
  loadWorkspaceMemberships,
  type WorkspaceMembership,
} from "@/platform/workspace-context";
import { terminateAuthSession } from "@/platform/identity-auth";
import { AuthField, AuthNotice, AuthPrimaryButton, AuthShell } from "@/features/auth/components";

/** The pre-provisioning draft. It is frontend state only until Finish or Skip is pressed. */
interface InitialSetupDraft {
  name: string;
  logoText: string;
  locale: string;
  timeZone: string;
  baseCurrency: string;
}

const STEPS = ["workspace", "region", "review"] as const;
type StepId = (typeof STEPS)[number];

const EMPTY_DRAFT: InitialSetupDraft = { name: "", logoText: "", locale: "", timeZone: "", baseCurrency: "" };

/** Backend-declared server defaults, shown as placeholders so Skip is predictable. */
const SERVER_DEFAULTS = { name: "My Workspace", locale: "en", timeZone: "UTC", baseCurrency: "USD" } as const;
const SUPPORTED_LOCALES = ["en", "vi"] as const;

/**
 * Initial Setup.
 *
 * Reached only when GET /workspaces returned zero active memberships. Moving between
 * steps or editing a field creates nothing on the backend. Finish sends the draft and
 * Skip sends the documented empty intent; both go through the single
 * POST /workspaces/initial-provisioning workflow, which owns workspace, membership,
 * role, assignment and configuration creation. The frontend then refetches
 * GET /workspaces and enters through the normal canonical path.
 */
export const InitialSetupPage: React.FC = () => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const navigate = useNavigate();

  const [step, setStep] = React.useState<StepId>("workspace");
  const [draft, setDraft] = React.useState<InitialSetupDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = React.useState<"finish" | "skip" | null>(null);
  const [error, setError] = React.useState<string>();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const stepIndex = STEPS.indexOf(step);
  const update = (key: keyof InitialSetupDraft) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const provision = async (intent: "finish" | "skip") => {
    setSubmitting(intent);
    setError(undefined);
    setFieldErrors({});
    try {
      const client = new WorkspaceProvisioningApiClient(requireHttpClient());
      const request: ProvisionInitialWorkspaceRequest = intent === "skip" ? {} : toProvisioningRequest(draft);
      const result = await client.provisionInitialWorkspace(request, {
        idempotencyKey: createProvisioningIdempotencyKey(),
      });
      // 200 REPLAYED and 201 PROVISIONED are both success. The provisioning response is
      // never turned into frontend workspace runtime directly.
      await enterProvisionedWorkspace(result.workspaceId);
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409 && cause.code === "WORKSPACE_ALREADY_PROVISIONED") {
        // The account already holds workspace access. Membership is authoritative, so
        // converge on it rather than reporting a failure.
        try {
          await enterFirstActiveWorkspace();
          return;
        } catch {
          navigate(ROUTE_KEYS.WORKSPACE_SELECTION, { replace: true });
          return;
        }
      }
      if (cause instanceof ApiClientError && cause.fieldErrors) setFieldErrors(cause.fieldErrors);
      setError(describeProvisioningFailure(cause, vi));
    } finally {
      setSubmitting(null);
    }
  };

  const enterProvisionedWorkspace = async (workspaceId: string) => {
    const memberships = await loadWorkspaceMemberships();
    const membership = memberships.find((item) => item.workspaceId === workspaceId && item.status === "active");
    if (!membership) throw new Error("PROVISIONED_WORKSPACE_NOT_LISTED");
    await enterWorkspace(membership.workspaceId);
    navigate(productSpaceHome(membership.workspaceKey, "crm"), { replace: true });
  };

  const enterFirstActiveWorkspace = async () => {
    const memberships = (await loadWorkspaceMemberships()).filter((item: WorkspaceMembership) => item.status === "active");
    const membership = memberships[0];
    if (!membership) throw new Error("NO_ACTIVE_WORKSPACE");
    await enterWorkspace(membership.workspaceId);
    navigate(productSpaceHome(membership.workspaceKey, "crm"), { replace: true });
  };

  const useAnotherAccount = async () => {
    await terminateAuthSession("SWITCH_ACCOUNT");
    navigate(ROUTE_KEYS.LOGIN, { replace: true });
  };

  const busy = submitting !== null;

  return (
    <AuthShell
      visualMode="neutral"
      title={vi ? "Thiết lập ban đầu" : "Initial setup"}
      footer={
        <button type="button" onClick={() => { void useAnotherAccount(); }} className="font-semibold text-indigo-600 transition hover:text-indigo-800 hover:underline">
          {vi ? "Dùng tài khoản khác" : "Use another account"}
        </button>
      }
    >
      <div className="space-y-5">
        <StepIndicator index={stepIndex} vi={vi} />

        {error && <AuthNotice tone="danger">{error}</AuthNotice>}

        {step === "workspace" && (
          <div className="space-y-4">
            <AuthNotice tone="info">
              {vi
                ? "Chưa có không gian làm việc nào cho tài khoản này. Đặt tên rồi hoàn tất, hoặc bỏ qua để dùng thiết lập mặc định."
                : "This account has no workspace yet. Name one and finish, or skip to use the server defaults."}
            </AuthNotice>
            <AuthField
              label={vi ? "Tên không gian làm việc" : "Workspace name"}
              value={draft.name}
              onChange={update("name")}
              placeholder={SERVER_DEFAULTS.name}
              icon={<Building2 size={16} />}
              maxLength={200}
              disabled={busy}
            />
            <FieldIssue messages={fieldErrors.name} />
            <AuthField
              label={vi ? "Ký hiệu (tối đa 8 ký tự)" : "Logo text (up to 8 characters)"}
              value={draft.logoText}
              onChange={update("logoText")}
              placeholder={vi ? "Tự sinh từ tên" : "Derived from the name"}
              maxLength={8}
              disabled={busy}
            />
            <FieldIssue messages={fieldErrors.logoText} />
          </div>
        )}

        {step === "region" && (
          <div className="space-y-4">
            <AuthField
              label={vi ? "Ngôn ngữ (en hoặc vi)" : "Locale (en or vi)"}
              value={draft.locale}
              onChange={update("locale")}
              placeholder={SERVER_DEFAULTS.locale}
              icon={<Globe2 size={16} />}
              list="initial-setup-locales"
              disabled={busy}
            />
            <datalist id="initial-setup-locales">
              {SUPPORTED_LOCALES.map((value) => <option key={value} value={value} />)}
            </datalist>
            <FieldIssue messages={fieldErrors.locale} />
            <AuthField
              label={vi ? "Múi giờ" : "Time zone"}
              value={draft.timeZone}
              onChange={update("timeZone")}
              placeholder={SERVER_DEFAULTS.timeZone}
              maxLength={100}
              disabled={busy}
            />
            <FieldIssue messages={fieldErrors.timeZone} />
            <AuthField
              label={vi ? "Tiền tệ gốc" : "Base currency"}
              value={draft.baseCurrency}
              onChange={update("baseCurrency")}
              placeholder={SERVER_DEFAULTS.baseCurrency}
              maxLength={3}
              disabled={busy}
            />
            <FieldIssue messages={fieldErrors.baseCurrency} />
          </div>
        )}

        {step === "review" && (
          <dl className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs">
            <ReviewRow label={vi ? "Tên" : "Name"} value={draft.name || SERVER_DEFAULTS.name} />
            <ReviewRow label={vi ? "Ký hiệu" : "Logo text"} value={draft.logoText || (vi ? "Tự sinh" : "Derived")} />
            <ReviewRow label={vi ? "Ngôn ngữ" : "Locale"} value={draft.locale || SERVER_DEFAULTS.locale} />
            <ReviewRow label={vi ? "Múi giờ" : "Time zone"} value={draft.timeZone || SERVER_DEFAULTS.timeZone} />
            <ReviewRow label={vi ? "Tiền tệ" : "Currency"} value={draft.baseCurrency || SERVER_DEFAULTS.baseCurrency} />
          </dl>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={stepIndex === 0 || busy}
            onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)])}
            className="h-12 flex-1 rounded-2xl border border-slate-200 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {vi ? "Quay lại" : "Back"}
          </button>
          {stepIndex < STEPS.length - 1 ? (
            <div className="flex-1">
              <AuthPrimaryButton type="button" disabled={busy} onClick={() => setStep(STEPS[stepIndex + 1])}>
                {vi ? "Tiếp tục" : "Next"}
              </AuthPrimaryButton>
            </div>
          ) : (
            <div className="flex-1">
              <AuthPrimaryButton
                type="button"
                loading={submitting === "finish"}
                disabled={busy}
                loadingLabel={vi ? "Đang tạo…" : "Creating…"}
                onClick={() => { void provision("finish"); }}
              >
                {vi ? "Hoàn tất" : "Finish"}
              </AuthPrimaryButton>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => { void provision("skip"); }}
          className="w-full rounded-2xl px-4 py-3 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "skip"
            ? (vi ? "Đang tạo…" : "Creating…")
            : (vi ? "Bỏ qua và dùng mặc định" : "Skip and use the defaults")}
        </button>
      </div>
    </AuthShell>
  );
};

const StepIndicator: React.FC<{ index: number; vi: boolean }> = ({ index, vi }) => {
  const labels = vi ? ["Không gian", "Khu vực", "Xem lại"] : ["Workspace", "Region", "Review"];
  return (
    <ol className="flex items-center gap-2 text-[11px] font-medium">
      {labels.map((label, position) => (
        <li key={label} className="flex flex-1 items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${
              position < index ? "bg-indigo-600 text-white"
                : position === index ? "border border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border border-slate-200 bg-white text-slate-400"
            }`}
          >
            {position < index ? <Check size={12} /> : position + 1}
          </span>
          <span className={position === index ? "text-slate-800" : "text-slate-400"}>{label}</span>
        </li>
      ))}
    </ol>
  );
};

const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3">
    <dt className="text-slate-500">{label}</dt>
    <dd className="crm-text-wrap text-right font-medium text-slate-800">{value}</dd>
  </div>
);

const FieldIssue: React.FC<{ messages?: string[] }> = ({ messages }) =>
  messages?.length ? <p role="alert" className="text-[11px] font-medium text-rose-600">{messages.join(" ")}</p> : null;

function requireHttpClient() {
  const client = getApplicationHttpClient();
  if (!client) throw new Error("CONNECTED_HTTP_CLIENT_UNAVAILABLE");
  return client;
}

function describeProvisioningFailure(error: unknown, vi: boolean): string {
  if (!(error instanceof ApiClientError)) {
    return vi
      ? "Không tạo được không gian làm việc. Vui lòng thử lại."
      : "The workspace could not be created. Please try again.";
  }
  if (error.code === "VALIDATION_FAILED" || error.status === 422) {
    return vi ? "Một số giá trị chưa hợp lệ. Vui lòng kiểm tra lại." : "Some values are not valid. Please review them.";
  }
  if (error.code === "IDEMPOTENCY_KEY_REUSED") {
    return vi ? "Yêu cầu trước đó chưa khớp. Hãy thử lại." : "The previous request did not match. Please try again.";
  }
  if (error.status === 401) {
    return vi ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại." : "Your session expired. Please sign in again.";
  }
  if (error.status === 403) {
    return vi ? "Tài khoản này không được phép tạo không gian làm việc." : "This account is not permitted to create a workspace.";
  }
  if (error.status === undefined || error.status >= 500) {
    return vi
      ? "Không kết nối được máy chủ UnicoreCRM. Kiểm tra ApiHost rồi thử lại."
      : "Cannot reach the UnicoreCRM server. Check that the ApiHost is running, then try again.";
  }
  // `userMessage` is contract copy the server wrote for a reader. `message` is the internal
  // diagnostic, and falling through to it would put topology in front of the visitor, so the
  // last resort is the same safe sentence the non-contract branch above uses.
  return error.userMessage ?? (vi
    ? "Không tạo được không gian làm việc. Vui lòng thử lại."
    : "The workspace could not be created. Please try again.");
}

export default InitialSetupPage;
