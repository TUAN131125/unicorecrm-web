import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { getContactDetailResource } from "../../application/vertical-slice/contactAuthoritativeQueries";
import { useContactReadAuthorityScope } from "./useContactReadAuthorityScope";
import { useContactDetailController, type ContactDetailPageProps } from "./useContactDetailController";

export function useContactDetailPageController(props: ContactDetailPageProps) {
  const controller = useContactDetailController(props);
  const navigate = useNavigate();
  const { tx, locale } = useI18n();
  const { contactId } = useParams<{ contactId: string }>();
  const scopeKey = useContactReadAuthorityScope();
  const resource = React.useMemo(() => getContactDetailResource(contactId ?? "__missing_contact__"), [contactId, scopeKey]);
  const detailQuery = useModuleAuthoritativeResource(resource, { enabled: Boolean(contactId), scopeKey, onScopeChange: resource.reset });
  const failure = detailQuery.error;


  return { controller, navigate, tx, locale, detailQuery, failure };
}
