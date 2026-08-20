export const SAFE_OPAQUE_SECURITY_VALUE = "fixture-value-without-provider-meaning";

export const PROVIDER_SHAPED_SECURITY_VALUES = {
  awsAccessKey: ["AK", "IA", "0123456789ABCDEF"].join(""),
  githubToken: ["gh", "p_", "abcdefghijklmnopqrstuvwxyz0123456789"].join(""),
  openAiKey: ["sk", "-proj-", "abcdefghijklmnopqrstuvwxyz012345"].join(""),
  slackToken: ["xo", "xb-", "1234567890-1234567890-abcdefghij"].join(""),
  googleApiKey: ["AI", "za", "0123456789abcdefghijklmnopqrstuvwxyz_"].join("").slice(0, 39),
  stripeLiveKey: ["sk", "_live_", "abcdefghijklmnopqrstuvwxyz012345"].join(""),
  privateKeyBlock: ["-----BEGIN ", "PRIVATE KEY-----\n", "ZmFrZS10ZXN0LW1hdGVyaWFs\n", "-----END ", "PRIVATE KEY-----"].join(""),
} as const;

export const FORBIDDEN_BROWSER_ENVIRONMENT_NAMES = [
  ["VITE", "PROVIDER", "SECRET"].join("_"),
  ["VITE", "SIGNING", "KEY"].join("_"),
  ["VITE", "WEBHOOK", "SECRET"].join("_"),
  ["VITE", "PRIVATE", "KEY"].join("_"),
] as const;
