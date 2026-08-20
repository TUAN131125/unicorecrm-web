export function findGuidanceTarget(root: ParentNode, targetId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-guidance-id="${targetId}"]`);
}
