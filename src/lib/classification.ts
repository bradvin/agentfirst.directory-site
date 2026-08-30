export type Classification =
  | "agent-native"
  | "agent-enabling"
  | "agent-internet-protocol";

export function normalizeClassification(classification: Classification | null): Classification | undefined {
  return classification ?? undefined;
}

export function formatClassification(classification: Classification) {
  switch (classification) {
    case "agent-native":
      return "Agent-native";
    case "agent-enabling":
      return "Agent-enabling";
    case "agent-internet-protocol":
      return "Agent internet protocol";
  }
}
