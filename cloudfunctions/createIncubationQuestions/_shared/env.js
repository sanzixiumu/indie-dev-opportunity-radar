function resolveTaskConfig(taskType, env = {}) {
  if (taskType === "web_research") {
    const provider = env.AI_WEB_RESEARCH_PROVIDER || env.AI_PROVIDER || "doubao";

    return {
      provider,
      model: env.AI_WEB_RESEARCH_MODEL || "",
      ...resolveProviderConfig(provider, env)
    };
  }

  const provider = env.AI_REASONING_PROVIDER || env.AI_PROVIDER || "deepseek";

  return {
    provider,
    model: env.AI_REASONING_MODEL || env.AI_MODEL || "deepseek-v4-pro",
    ...resolveProviderConfig(provider, env)
  };
}

function resolveProviderConfig(provider, env = {}) {
  if (provider === "deepseek") {
    return {
      apiKey: env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY || "",
      baseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
    };
  }

  if (provider === "doubao") {
    return {
      apiKey: env.ARK_API_KEY || "",
      baseUrl: env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3"
    };
  }

  return {
    apiKey: env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY || "",
    baseUrl: undefined
  };
}

module.exports = {
  resolveTaskConfig,
  resolveProviderConfig
};
