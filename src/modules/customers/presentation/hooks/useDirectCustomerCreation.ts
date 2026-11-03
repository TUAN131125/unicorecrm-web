import React from "react";
import { flushSync } from "react-dom";
import { useBoundFormDraft } from "@/shared/hooks/useBoundFormDraft";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { useDealSelectionAuthority } from "@/components/crm/useCommercialSelection";
import { presentApplicationError } from "@/shared/operations";
import { checkDirectCustomerPhone, createDirectCustomerCommand, createCustomerCommand,
  type CreateDirectCustomerInput, type CustomerPhoneCandidate } from "../../public/api";
import type { CreateCustomerRequest } from "../../application/ports/CustomerApiRuntime";

interface Draft {
  type: "B2C" | "B2B"; name: string; phone: string; email: string; legalName: string; taxCode: string;
  address: string; notes: string; segment: string; tags: string;
  tier: "" | NonNullable<CreateDirectCustomerInput["tier"]>; serviceLevel: "" | NonNullable<CreateDirectCustomerInput["serviceLevel"]>;
  different: boolean;
}
type PendingRequest = { intent: string; kind: "direct"; input: CreateDirectCustomerInput }
  | { intent: string; kind: "existing"; input: CreateCustomerRequest; key: string };

export function useDirectCustomerCreation(open: boolean, onClose: () => void, onCreated: (id: string) => void, vi: boolean) {
  const access = useEffectiveAccess(); const authority = useDealSelectionAuthority();
  const canDirect = access.can(CAPABILITIES.CUSTOMERS_CREATE_DIRECT);
  const lifecycle = useBoundFormDraft<Draft, object>(open, "direct-customer", {}, () => ({
    type: "B2C", name: "", phone: "", email: "", legalName: "", taxCode: "", address: "", notes: "",
    segment: "", tags: "", tier: "", serviceLevel: "", different: false,
  }), "Create Customer", onClose);
  const { draft } = lifecycle;
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState("");
  const [unknown, setUnknown] = React.useState(false);
  const frozen = React.useRef<PendingRequest | undefined>(undefined);
  const [revision, refreshPhone] = React.useReducer((n: number) => n + 1, 0);
  const [phone, setPhone] = React.useState<{ key: string; matches: CustomerPhoneCandidate[]; error?: string }>();
  const key = JSON.stringify([authority, draft.phone.trim(), revision]);
  React.useEffect(() => {
    if (!open) return;
    setFields({}); setError(""); setUnknown(false); frozen.current = undefined;
  }, [open, lifecycle.cycle]);
  React.useEffect(() => {
    if (!open || !canDirect || draft.phone.replace(/\D/g, "").length < 9) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void checkDirectCustomerPhone(draft.phone.trim(), abort.signal).then(matches => {
        if (!abort.signal.aborted) setPhone({ key, matches });
      }).catch(caught => { if (!abort.signal.aborted) setPhone({ key, matches: [], error: presentApplicationError(caught, { locale: vi ? "vi" : "en" }).message }); });
    }, 300);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [open, canDirect, draft.phone, key, vi]);
  const phoneState = phone?.key === key ? phone : undefined;
  const matches = phoneState?.matches ?? [];
  const sourceResource = draft.type === "B2C" ? "contacts" : "organizations";
  const sourceCapability = draft.type === "B2C" ? CAPABILITIES.CONTACTS_CREATE : CAPABILITIES.ORGANIZATIONS_CREATE;
  const permitted = access.can(CAPABILITIES.CUSTOMERS_CREATE_DIRECT) && access.can(sourceCapability)
    && access.getFieldAccess(sourceResource, draft.type === "B2C" ? "fullname" : "displayname") === "READ_WRITE";
  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    if (lifecycle.pending || unknown) return;
    lifecycle.setDraft(current => ({ ...current, [field]: value, ...(field === "phone" || field === "type" ? { different: false } : {}) }));
    setFields(current => ({ ...current, [field]: "" }));
  }
  function profile() {
    return { ...(draft.segment.trim() ? { segment: draft.segment.trim() } : {}), ...(draft.tags.trim() ? { tags: draft.tags.split(",").map(t => t.trim()).filter(Boolean) } : {}),
      ...(draft.tier ? { tier: draft.tier } : {}), ...(draft.serviceLevel ? { serviceLevel: draft.serviceLevel } : {}) };
  }
  function fieldMessage(field: string) {
    return field === "phone" ? (vi ? "Kiểm tra số điện thoại đầy đủ và hợp lệ." : "Check the complete phone number.")
      : field === "name" ? (vi ? "Nhập họ tên hoặc tên doanh nghiệp hợp lệ." : "Enter a valid person or business name.")
      : (vi ? "Kiểm tra thông tin trường này." : "Check this field.");
  }
  function failure(caught: unknown, wasUnknown: boolean) {
    const presentation = presentApplicationError(caught, { locale: vi ? "vi" : "en" });
    const e = presentation.error;
    const knownRejected = e.status !== undefined && [400, 401, 403, 404, 409, 412, 422, 429].includes(e.status);
    const requestInvalid = e.code === "CONTRACT_VIOLATION" && typeof e.details === "object" && e.details !== null && "direction" in e.details && e.details.direction === "request";
    if (!wasUnknown && (knownRejected || requestInvalid)) frozen.current = undefined;
    else setUnknown(true);
    if (e.code === "CUSTOMER_PHONE_REVIEW_REQUIRED") {
      lifecycle.setDraft(current => ({ ...current, different: false })); refreshPhone();
      setFields({ phone: vi ? "Số điện thoại này đã được sử dụng. Hãy đối chiếu hồ sơ bên dưới." : "This phone number is already in use. Review the records below." });
      setError(""); return;
    }
    const mapped = Object.fromEntries(Object.keys(e.fieldErrors ?? {}).map(field => [field, fieldMessage(field)]));
    setFields(mapped); setError(Object.keys(mapped).length ? "" : presentation.message);
    const first = Object.keys(mapped)[0]; if (first) requestAnimationFrame(() => document.getElementById(`direct-customer-${first}`)?.focus());
  }
  async function save(): Promise<boolean> {
    if (!permitted && !unknown) return false;
    if (!unknown && !draft.name.trim()) { setFields({ name: fieldMessage("name") }); document.getElementById("direct-customer-name")?.focus(); return false; }
    if (frozen.current?.intent === lifecycle.intentId) return perform(frozen.current);
    const request: CreateDirectCustomerInput = {
      type: draft.type, name: draft.name.trim(), ...profile(),
      ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}), ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
      ...(draft.type === "B2B" && draft.legalName.trim() ? { legalName: draft.legalName.trim() } : {}),
      ...(draft.type === "B2B" && draft.taxCode.trim() ? { taxCode: draft.taxCode.trim() } : {}),
      ...(draft.address.trim() ? { address: draft.address.trim() } : {}), ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
      differentCustomerConfirmed: draft.different, reviewedSources: matches.map(m => m.relationshipRef),
    };
    return perform({ intent: lifecycle.intentId, kind: "direct", input: request });
  }
  async function perform(request: PendingRequest): Promise<boolean> {
    const operation = lifecycle.begin(); if (!operation) return false;
    setFields({}); setError(""); const wasUnknown = unknown;
    frozen.current = structuredClone(request);
    try {
      const id = request.kind === "direct"
        ? (await createDirectCustomerCommand(request.input, { idempotencyKey: request.intent })).data.id
        : (await createCustomerCommand(request.input, { idempotencyKey: request.key })).id;
      if (!operation.isCurrent()) return false;
      flushSync(() => { operation.complete(); operation.finish(); onClose(); }); onCreated(id); return true;
    } catch (caught) { if (operation.isCurrent()) failure(caught, wasUnknown); return false; }
    finally { operation.finish(); }
  }
  async function onboard(candidate: CustomerPhoneCandidate) {
    if (unknown || !access.can(CAPABILITIES.CUSTOMERS_ONBOARD_EXISTING) || candidate.archived || candidate.customerId) return;
    return perform({ intent: lifecycle.intentId, kind: "existing", input: { relationshipRef: candidate.relationshipRef, ...profile() },
      key: `${lifecycle.intentId}:existing:${candidate.relationshipRef.id}` });
  }
  lifecycle.bindSave(save);
  return { draft, update, lifecycle, fields, error, unknown, matches, phoneError: phoneState?.error, permitted, sourceResource, save, onboard, access,
    requestClose: () => { if (!unknown) lifecycle.requestClose(); } };
}
