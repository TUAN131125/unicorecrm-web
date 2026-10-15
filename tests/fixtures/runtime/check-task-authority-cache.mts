const assert = Object.assign((condition: unknown, message = "Assertion failed") => {
  if (!condition) throw new Error(message);
}, {
  equal(actual: unknown, expected: unknown, message = "Expected equal values") { if (actual !== expected) throw new Error(message); },
  notEqual(actual: unknown, expected: unknown, message = "Expected distinct values") { if (actual === expected) throw new Error(message); },
});
import { getTaskCollectionResource, getTaskDetailResource, getActivityCollectionResource, getTaskReadAuthorityScope } from "@/modules/tasks/application/vertical-slice/taskAuthoritativeQueries";
import { getTaskApplicationServices } from "@/modules/tasks/application/composition/taskApplicationServices";

/** Called with actual connected principal/authority transitions by the browser harness. */
export async function runTaskAuthorityCacheRegression(options: {
  taskId: string;
  replacePrincipal(): Promise<void>;
  restorePrincipal(): Promise<void>;
  refreshAuthority(): Promise<void>;
}): Promise<void> {
  const collection = getTaskCollectionResource(), detail = getTaskDetailResource(options.taskId), activities = getActivityCollectionResource();
  await collection.load(); await detail.load(); await activities.load();
  assert(collection.getSnapshot().data?.items.some((task) => task.id === options.taskId));
  const previousScope = getTaskReadAuthorityScope(); assert(previousScope);
  await options.replacePrincipal();
  assert.notEqual(getTaskReadAuthorityScope(), previousScope);
  assert.equal(detail.getSnapshot().data, undefined);
  assert(!collection.getSnapshot().data?.items.some((task) => task.id === options.taskId));
  assert(!getTaskApplicationServices().repository.snapshot().tasks.some((task) => task.id === options.taskId));
  await options.restorePrincipal();
  assert.notEqual(getTaskReadAuthorityScope(), previousScope, "A/B/A must use a new local generation");
  await collection.load(); assert(collection.getSnapshot().data?.items.some((task) => task.id === options.taskId));
  const beforeRevision = getTaskReadAuthorityScope();
  await options.refreshAuthority();
  assert.notEqual(getTaskReadAuthorityScope(), beforeRevision);
  assert.equal(detail.getSnapshot().data, undefined);
  await collection.load(); assert(collection.getSnapshot().data?.items.some((task) => task.id === options.taskId));
  console.log("Connected Tasks authority cache: collection/detail/activity retirement, A/B/A and revision PASS.");
}
