import React from "react";
import type { Contact } from "@/modules/contacts";
import type { OrganizationAccount } from "@/modules/organizations";
import { Input, Select } from "@/shared/components/ui";
import type { LeadRelationshipInput } from "../../domain/leadQualification.types";
import type { LeadQualificationFieldErrors } from "../../domain/leadQualification.rules";

interface Props {
  value: LeadRelationshipInput;
  onChange: (value: LeadRelationshipInput) => void;
  contacts: Contact[];
  organizations: OrganizationAccount[];
  locale: string;
  errors?: LeadQualificationFieldErrors;
}

export function RelationshipResolutionFields({ value, onChange, contacts, organizations, locale, errors = {} }: Props) {
  const vi = locale === "vi";
  const patch = (next: Partial<LeadRelationshipInput>) => onChange({ ...value, ...next });
  const patchContact = (next: Partial<LeadRelationshipInput["contact"]>) => onChange({ ...value, contact: { ...value.contact, ...next } });
  const patchOrganization = (next: Partial<NonNullable<LeadRelationshipInput["organization"]>>) => onChange({
    ...value,
    organization: { displayName: "", ...(value.organization || {}), ...next },
  });

  const options = value.kind === "CONTACT" ? contacts : organizations;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select id="qualification-relationship-kind" label={vi ? "Loại quan hệ" : "Relationship type"} value={value.kind} onChange={(event) => patch({ kind: event.target.value as LeadRelationshipInput["kind"], selectedId: undefined })}>
          <option value="CONTACT">{vi ? "Cá nhân / Contact" : "Contact"}</option>
          <option value="ORGANIZATION_ACCOUNT">{vi ? "Tổ chức / Organization Account" : "Organization Account"}</option>
        </Select>
        <Select id="qualification-relationship-mode" label={vi ? "Cách xử lý" : "Resolution mode"} value={value.mode} onChange={(event) => patch({ mode: event.target.value as LeadRelationshipInput["mode"], selectedId: undefined })}>
          <option value="NEW">{vi ? "Tạo relationship mới" : "Create new relationship"}</option>
          <option value="EXISTING">{vi ? "Liên kết relationship hiện có" : "Link existing relationship"}</option>
        </Select>
      </div>

      {value.mode === "EXISTING" ? (
        <Select
          id="qualification-relationship-selected"
          label={value.kind === "CONTACT" ? (vi ? "Chọn Contact" : "Select Contact") : (vi ? "Chọn Organization Account" : "Select Organization Account")}
          value={value.selectedId || ""}
          onChange={(event) => patch({ selectedId: event.target.value })}
          required
          error={errors["relationship.selectedId"]}
        >
          <option value="">{vi ? "-- Chọn --" : "-- Select --"}</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>{"fullName" in item ? item.fullName : item.displayName}</option>
          ))}
        </Select>
      ) : (
        <>
          {value.kind === "ORGANIZATION_ACCOUNT" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <Input id="qualification-organization-name" label={vi ? "Tên tổ chức" : "Organization name"} value={value.organization?.displayName || ""} onChange={(event) => patchOrganization({ displayName: event.target.value })} error={errors["relationship.organization.displayName"]} required />
              <Input label={vi ? "Mã số thuế" : "Tax code"} value={value.organization?.taxCode || ""} onChange={(event) => patchOrganization({ taxCode: event.target.value })} />
              <Input label="Domain" value={value.organization?.domain || ""} onChange={(event) => patchOrganization({ domain: event.target.value })} />
              <Input label={vi ? "Ngành" : "Industry"} value={value.organization?.industry || ""} onChange={(event) => patchOrganization({ industry: event.target.value })} />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="qualification-contact-name" label={vi ? "Tên liên hệ" : "Contact name"} value={value.contact.name} onChange={(event) => patchContact({ name: event.target.value })} error={errors["relationship.contact.name"]} required />
            <Input label={vi ? "Chức danh" : "Title"} value={value.contact.title || ""} onChange={(event) => patchContact({ title: event.target.value })} />
            <Input id="qualification-contact-email" label="Email" type="email" value={value.contact.email || ""} onChange={(event) => patchContact({ email: event.target.value })} error={errors["relationship.contact.email"]} />
            <Input id="qualification-contact-phone" label={vi ? "Điện thoại" : "Phone"} inputMode="tel" value={value.contact.phone || ""} onChange={(event) => patchContact({ phone: event.target.value })} error={errors["relationship.contact.phone"]} />
          </div>
        </>
      )}
    </div>
  );
}
