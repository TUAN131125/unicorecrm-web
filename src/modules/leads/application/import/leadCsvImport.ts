import { validateLeadContactData } from "../../domain/rules/leadContactData";

export interface LeadCsvImportCandidate {
  rowNumber: number;
  name: string;
  phone?: string;
  workPhone?: string;
  email?: string;
  companyName?: string;
  title?: string;
  source?: string;
  ownerId?: string;
  painPoint?: string;
  nextFollowUpAt?: string;
  preferredChannel?: "phone" | "email" | "zalo" | "facebook" | "other";
}

export interface LeadCsvImportRowResult {
  rowNumber: number;
  values: Record<string, string>;
  candidate?: LeadCsvImportCandidate;
  errors: string[];
}

export interface LeadCsvImportPlan {
  version: 1;
  checksum: string;
  headers: string[];
  rows: LeadCsvImportRowResult[];
  candidates: LeadCsvImportCandidate[];
  invalidRowCount: number;
}

const HEADER_ALIASES: Record<string, keyof Omit<LeadCsvImportCandidate, "rowNumber">> = {
  name: "name",
  fullname: "name",
  hoten: "name",
  ten: "name",
  phone: "phone",
  mobile: "phone",
  sodienthoai: "phone",
  sdt: "phone",
  workphone: "workPhone",
  dienthoaicongviec: "workPhone",
  email: "email",
  company: "companyName",
  companyname: "companyName",
  congty: "companyName",
  tencongty: "companyName",
  title: "title",
  jobtitle: "title",
  chucdanh: "title",
  source: "source",
  nguon: "source",
  ownerid: "ownerId",
  owner: "ownerId",
  nguoiphutrach: "ownerId",
  painpoint: "painPoint",
  nhucau: "painPoint",
  nextfollowupat: "nextFollowUpAt",
  followup: "nextFollowUpAt",
  ngaychamsoc: "nextFollowUpAt",
  preferredchannel: "preferredChannel",
  kenhuutien: "preferredChannel",
};

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted value.");
  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
}

function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizePreferredChannel(value: string): LeadCsvImportCandidate["preferredChannel"] | undefined {
  const normalized = normalizeToken(value);
  if (!normalized) return undefined;
  if (["phone", "call", "dienthoai"].includes(normalized)) return "phone";
  if (["email", "mail"].includes(normalized)) return "email";
  if (normalized === "zalo") return "zalo";
  if (normalized === "facebook") return "facebook";
  if (normalized === "other" || normalized === "khac") return "other";
  return undefined;
}

function normalizePhone(value: string | undefined): string {
  return String(value || "").replace(/[^0-9+]/g, "");
}

export function buildLeadCsvImportPlan(text: string, maximumRows = 5000): LeadCsvImportPlan {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const rawRows = parseCsvRows(normalizedText);
  if (rawRows.length < 2) throw new Error("CSV must contain a header row and at least one data row.");
  if (rawRows.length - 1 > maximumRows) throw new Error(`CSV exceeds the maximum of ${maximumRows} data rows.`);

  const headers = rawRows[0].map((header) => header.trim());
  const mappedHeaders = headers.map((header) => HEADER_ALIASES[normalizeToken(header)]);
  if (!mappedHeaders.includes("name")) throw new Error("CSV is missing a supported full-name column.");
  if (!mappedHeaders.some((header) => header === "phone" || header === "workPhone" || header === "email")) {
    throw new Error("CSV must include at least one supported phone or email column.");
  }

  const seenContacts = new Map<string, number>();
  const rows: LeadCsvImportRowResult[] = rawRows.slice(1).map((raw, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const values = Object.fromEntries(headers.map((header, index) => [header, String(raw[index] || "").trim()]));
    const errors: string[] = [];
    const candidate: LeadCsvImportCandidate = { rowNumber, name: "" };
    mappedHeaders.forEach((property, index) => {
      if (!property) return;
      const value = String(raw[index] || "").trim();
      if (property === "preferredChannel") {
        const channel = normalizePreferredChannel(value);
        if (channel) candidate.preferredChannel = channel;
        else if (value) errors.push(`Unsupported preferred contact channel: ${value}.`);
      } else {
        candidate[property] = value as never;
      }
    });

    if (!candidate.name.trim()) errors.push("Full name is required.");
    if (!candidate.phone?.trim() && !candidate.workPhone?.trim() && !candidate.email?.trim()) {
      errors.push("At least one phone or email value is required.");
    }
    const contactErrors = validateLeadContactData(candidate);
    Object.values(contactErrors).forEach((message) => {
      if (message && !errors.includes(message)) errors.push(message);
    });
    const contactKey = candidate.email?.trim().toLocaleLowerCase()
      ? `email:${candidate.email.trim().toLocaleLowerCase()}`
      : `phone:${normalizePhone(candidate.phone || candidate.workPhone)}`;
    if (contactKey !== "phone:") {
      const duplicateRow = seenContacts.get(contactKey);
      if (duplicateRow) errors.push(`Duplicate contact in CSV row ${duplicateRow}.`);
      else seenContacts.set(contactKey, rowNumber);
    }

    return {
      rowNumber,
      values,
      candidate: errors.length === 0 ? candidate : undefined,
      errors,
    };
  });

  const candidates = rows.flatMap((row) => row.candidate ? [row.candidate] : []);
  return {
    version: 1,
    checksum: checksum(normalizedText),
    headers,
    rows,
    candidates,
    invalidRowCount: rows.length - candidates.length,
  };
}
