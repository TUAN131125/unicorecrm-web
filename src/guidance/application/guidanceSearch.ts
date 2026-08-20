import type { CanonicalProductSpace } from "@/platform/navigation";
import { normalizeGuidanceSearch } from "@/guidance/domain/guidance.rules";
import type { CapabilityPredicate, GuidanceLocale, GuidanceSearchResult } from "@/guidance/domain/guidance.types";
import { GUIDANCE_FIELDS, GUIDANCE_WORKFLOWS, SCREEN_GUIDANCE } from "./guidanceRegistry";
import { hasAllCapabilities } from "@/guidance/domain/guidance.rules";

export function searchGuidance(
  query: string,
  locale: GuidanceLocale,
  productSpace: CanonicalProductSpace,
  can: CapabilityPredicate,
): GuidanceSearchResult[] {
  const normalized = normalizeGuidanceSearch(query);
  if (!normalized) return [];
  const terms = normalized.split(" ").filter(Boolean);
  const scoreText = (values: string[], boost = 0) => {
    const haystack = normalizeGuidanceSearch(values.join(" "));
    if (!terms.every((term) => haystack.includes(term))) return -1;
    return boost + terms.reduce((score, term) => score + (haystack.startsWith(term) ? 4 : 1), 0);
  };

  const results: Array<{ result: GuidanceSearchResult; score: number }> = [];
  for (const screen of SCREEN_GUIDANCE) {
    if (!hasAllCapabilities(screen.requiredCapabilities, can)) continue;
    const score = scoreText([
      screen.title.vi, screen.title.en, screen.purpose.vi, screen.purpose.en,
      screen.keywords?.vi || "", screen.keywords?.en || "",
      ...screen.primaryTasks.flatMap((task) => [task.text.vi, task.text.en]),
    ], screen.productSpace === productSpace ? 8 : 0);
    if (score >= 0) results.push({
      score,
      result: { kind: "screen", id: screen.id, title: screen.title, summary: screen.purpose, productSpace: screen.productSpace, routeKey: screen.routeKey },
    });
  }

  for (const workflow of GUIDANCE_WORKFLOWS) {
    const visibleSteps = workflow.steps.filter((step) => hasAllCapabilities(step.requiredCapabilities, can));
    if (visibleSteps.length === 0) continue;
    const score = scoreText([
      workflow.title.vi, workflow.title.en, workflow.summary.vi, workflow.summary.en,
      workflow.keywords?.vi || "", workflow.keywords?.en || "",
      ...visibleSteps.flatMap((step) => [step.title.vi, step.title.en, step.body.vi, step.body.en]),
    ], workflow.productSpaces.includes(productSpace) ? 5 : 0);
    if (score >= 0) results.push({
      score,
      result: { kind: "workflow", id: workflow.id, title: workflow.title, summary: workflow.summary, productSpace: workflow.productSpaces[0] },
    });
  }

  for (const field of GUIDANCE_FIELDS) {
    const score = scoreText([field.title.vi, field.title.en, field.purpose.vi, field.purpose.en, field.keywords?.vi || "", field.keywords?.en || ""]);
    if (score >= 0) results.push({ score, result: { kind: "field", id: field.helpKey, title: field.title, summary: field.purpose } });
  }

  return results.sort((left, right) => right.score - left.score).slice(0, 20).map((entry) => entry.result);
}
