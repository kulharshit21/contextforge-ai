export type PrivacyMode = "local" | "cloud";
export type ProviderName = "gemini" | "ollama" | "mock";

function getEnvValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

export function isVercel() {
  return getEnvValue("VERCEL") === "1";
}

export function isSupabaseConfigured() {
  return Boolean(
    getEnvValue("NEXT_PUBLIC_SUPABASE_URL") &&
      getEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

export function getPrivacyMode(): PrivacyMode {
  const value = getEnvValue("CONTEXTFORGE_PRIVACY_MODE").toLowerCase();
  return value === "cloud" ? "cloud" : "local";
}

export function getPreferredProvider(): ProviderName {
  const value = getEnvValue("CONTEXTFORGE_AI_PROVIDER").toLowerCase();

  if (value === "gemini" || value === "ollama" || value === "mock") {
    return value;
  }

  if (getEnvValue("GEMINI_API_KEY")) {
    return "gemini";
  }

  if (getEnvValue("OLLAMA_BASE_URL")) {
    return "ollama";
  }

  return "mock";
}

export function getOllamaBaseUrl() {
  return getEnvValue("OLLAMA_BASE_URL") || "http://localhost:11434";
}

export function isDemoMode() {
  return isVercel() || !isSupabaseConfigured();
}

export function canUseLocalWorkspaceFilesystem() {
  return !isVercel();
}

export function isCloudProvider(provider: ProviderName) {
  return provider === "gemini";
}
