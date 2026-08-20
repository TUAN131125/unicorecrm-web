export interface ContactIdentityCandidate {
  id: string;
  name?: string;
  fullName?: string;
  email?: string;
  workEmail?: string;
  personalEmail?: string;
  phone?: string;
  mobilePhone?: string;
  workPhone?: string;
}

export interface OrganizationIdentityCandidate {
  id: string;
  displayName?: string;
  legalName?: string;
  taxCode?: string;
  domain?: string;
  website?: string;
  email?: string;
  phone?: string;
}

export interface ContactIdentityInput {
  name?: string;
  email?: string;
  phone?: string;
}

export interface OrganizationIdentityInput {
  displayName?: string;
  legalName?: string;
  taxCode?: string;
  domain?: string;
  website?: string;
  email?: string;
  phone?: string;
}

export interface IdentityMatch<T> {
  record: T;
  score: number;
  matchedBy: string[];
}

export function findBestContactIdentityMatch<T extends ContactIdentityCandidate>(
  candidates: readonly T[],
  input: ContactIdentityInput,
): IdentityMatch<T> | undefined {
  const normalizedInput = {
    name: normalizeIdentityText(input.name),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
  };

  const matches = candidates
    .map((record) => scoreContact(record, normalizedInput))
    .filter((match): match is IdentityMatch<T> => Boolean(match))
    .sort((left, right) => right.score - left.score);

  const best = matches[0];
  if (!best || best.score < contactThreshold(normalizedInput)) return undefined;
  if (!normalizedInput.email && !normalizedInput.phone && matches[1]?.score === best.score) return undefined;
  return best;
}

export function findBestOrganizationIdentityMatch<T extends OrganizationIdentityCandidate>(
  candidates: readonly T[],
  input: OrganizationIdentityInput,
): IdentityMatch<T> | undefined {
  const normalizedInput = {
    displayName: normalizeIdentityText(input.displayName),
    legalName: normalizeIdentityText(input.legalName),
    taxCode: normalizeTaxCode(input.taxCode),
    domain: normalizeDomain(input.domain || input.website),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
  };

  const matches = candidates
    .map((record) => scoreOrganization(record, normalizedInput))
    .filter((match): match is IdentityMatch<T> => Boolean(match))
    .sort((left, right) => right.score - left.score);

  const best = matches[0];
  if (!best || best.score < organizationThreshold(normalizedInput)) return undefined;
  if (!normalizedInput.taxCode && !normalizedInput.domain && !normalizedInput.email && !normalizedInput.phone && matches[1]?.score === best.score) return undefined;
  return best;
}

export function normalizeIdentityText(value?: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeEmail(value?: string): string {
  return (value || "").trim().toLowerCase();
}

export function normalizePhone(value?: string): string {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("84") && digits.length >= 10) return `0${digits.slice(2)}`;
  return digits;
}

export function normalizeDomain(value?: string): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0];
}

export function normalizeTaxCode(value?: string): string {
  return (value || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function scoreContact<T extends ContactIdentityCandidate>(
  record: T,
  input: { name: string; email: string; phone: string },
): IdentityMatch<T> | undefined {
  const recordEmails = [record.email, record.workEmail, record.personalEmail].map(normalizeEmail).filter(Boolean);
  const recordPhones = [record.phone, record.mobilePhone, record.workPhone].map(normalizePhone).filter(Boolean);
  const recordNames = [record.fullName, record.name].map(normalizeIdentityText).filter(Boolean);
  let score = 0;
  const matchedBy: string[] = [];

  if (input.email && recordEmails.includes(input.email)) {
    score += 100;
    matchedBy.push("email");
  }
  if (input.phone && recordPhones.includes(input.phone)) {
    score += 95;
    matchedBy.push("phone");
  }
  if (input.name && recordNames.includes(input.name)) {
    score += 35;
    matchedBy.push("name");
  } else if (input.name) {
    const similarity = Math.max(0, ...recordNames.map((name) => identityTextSimilarity(input.name, name)));
    if (similarity >= 0.9) {
      score += 30 + Math.round((similarity - 0.9) * 50);
      matchedBy.push("name:fuzzy");
    }
  }

  return score > 0 ? { record, score, matchedBy } : undefined;
}

function scoreOrganization<T extends OrganizationIdentityCandidate>(
  record: T,
  input: { displayName: string; legalName: string; taxCode: string; domain: string; email: string; phone: string },
): IdentityMatch<T> | undefined {
  const recordNames = [record.displayName, record.legalName].map(normalizeIdentityText).filter(Boolean);
  const recordDomain = normalizeDomain(record.domain || record.website);
  const recordTaxCode = normalizeTaxCode(record.taxCode);
  const recordEmail = normalizeEmail(record.email);
  const recordPhone = normalizePhone(record.phone);
  let score = 0;
  const matchedBy: string[] = [];

  if (input.taxCode && recordTaxCode && input.taxCode === recordTaxCode) {
    score += 120;
    matchedBy.push("taxCode");
  }
  if (input.domain && recordDomain && input.domain === recordDomain) {
    score += 110;
    matchedBy.push("domain");
  }
  if (input.email && recordEmail && input.email === recordEmail) {
    score += 90;
    matchedBy.push("email");
  }
  if (input.phone && recordPhone && input.phone === recordPhone) {
    score += 85;
    matchedBy.push("phone");
  }
  if (input.legalName && recordNames.includes(input.legalName)) {
    score += 45;
    matchedBy.push("legalName");
  }
  if (input.displayName && recordNames.includes(input.displayName)) {
    score += 40;
    matchedBy.push("displayName");
  } else if (input.displayName) {
    const similarity = Math.max(0, ...recordNames.map((name) => identityTextSimilarity(input.displayName, name)));
    if (similarity >= 0.88) {
      score += 38 + Math.round((similarity - 0.88) * 16);
      matchedBy.push("displayName:fuzzy");
    }
  }

  return score > 0 ? { record, score, matchedBy } : undefined;
}

function contactThreshold(input: { name: string; email: string; phone: string }): number {
  if (input.email || input.phone) return 90;
  return input.name ? 35 : Number.POSITIVE_INFINITY;
}

function organizationThreshold(input: { displayName: string; legalName: string; taxCode: string; domain: string; email: string; phone: string }): number {
  if (input.taxCode || input.domain) return 100;
  if (input.email || input.phone) return 85;
  return input.displayName || input.legalName ? 40 : Number.POSITIVE_INFINITY;
}

export function identityTextSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeIdentityText(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeIdentityText(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const jaccard = union ? intersection / union : 0;
  const containment = intersection / Math.min(leftTokens.size, rightTokens.size);
  return (jaccard * 0.6) + (containment * 0.4);
}
