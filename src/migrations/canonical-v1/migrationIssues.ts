export type CanonicalMigrationDisposition = "SAFE" | "INFER" | "REVIEW";
export type CanonicalMigrationSeverity = "INFO" | "WARNING" | "ERROR";

export interface CanonicalMigrationIssue {
  issueId: string;
  sourceType: string;
  sourceId: string;
  disposition: CanonicalMigrationDisposition;
  severity: CanonicalMigrationSeverity;
  rule: string;
  message: string;
  candidateResolution?: string;
}

export class CanonicalMigrationIssueCollector {
  private readonly issues = new Map<string, CanonicalMigrationIssue>();

  add(issue: Omit<CanonicalMigrationIssue, "issueId">): CanonicalMigrationIssue {
    const issueId = [issue.sourceType, issue.sourceId, issue.rule].join(":");
    const fullIssue = { ...issue, issueId };
    this.issues.set(issueId, fullIssue);
    return fullIssue;
  }

  list(): CanonicalMigrationIssue[] {
    return [...this.issues.values()].sort((a, b) =>
      a.issueId.localeCompare(b.issueId),
    );
  }

  summary(): Record<CanonicalMigrationDisposition, number> {
    const summary = { SAFE: 0, INFER: 0, REVIEW: 0 };
    for (const issue of this.issues.values()) summary[issue.disposition] += 1;
    return summary;
  }
}
