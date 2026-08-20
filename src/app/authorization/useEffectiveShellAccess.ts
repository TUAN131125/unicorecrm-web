import { useEffectiveAccess } from "@/platform/access-control";

export function useEffectiveShellAccess() {
  return useEffectiveAccess();
}
