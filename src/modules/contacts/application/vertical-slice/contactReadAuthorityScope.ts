import { getContactRelationshipAuthority } from "../queries/contactRelationshipAuthority";

let projectionAuthorityScope: string | undefined;
export function getContactProjectionAuthorityScope(): string | undefined { return projectionAuthorityScope; }
export function markContactProjectionAuthorityScope(scope: string): void { projectionAuthorityScope = scope; }

export const getContactReadAuthorityScope = getContactRelationshipAuthority;
