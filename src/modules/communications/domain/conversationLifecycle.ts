import type { ConversationStatus } from "./models";

// UI intent vocabulary mirrors the scoped specification; the server always reauthorizes.
export function conversationTargets(status: ConversationStatus): readonly ConversationStatus[] {
  switch (status) {
    case "NEW": return ["OPEN", "CLOSED"];
    case "OPEN": return ["PENDING", "CLOSED"];
    case "PENDING": return ["OPEN", "CLOSED"];
    case "CLOSED": return ["OPEN"];
  }
}
