export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const token = env.OPENPHYSIO_TOKEN;
  if (!token) throw new Error("OPENPHYSIO_TOKEN is required (set it in the environment or .env)");
  return {
    token,
    dataDir: env.DATA_DIR || "./data",
    port: Number(env.PORT) || 8787,
    aiProvider: env.AI_PROVIDER || "mock",
    anthropicApiKey: env.ANTHROPIC_API_KEY || "",
  };
}
