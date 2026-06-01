const { resolveProviderConfig, resolveTaskConfig } = require("../env");
const { appError } = require("../response");
const deepseek = require("./providers/deepseek");
const doubao = require("./providers/doubao");

const DEFAULT_PROVIDERS = {
  deepseek,
  doubao
};

function createAiGateway({ env = process.env, providers = DEFAULT_PROVIDERS } = {}) {
  return {
    async callModel({
      taskType = "reasoning",
      provider,
      model,
      messages,
      responseFormat,
      tools,
      temperature,
      requestId
    }) {
      const taskConfig = resolveTaskConfig(taskType, env);
      const resolvedProvider = provider || taskConfig.provider;
      const resolvedModel = model || taskConfig.model;
      const providerConfig = resolveProviderConfig(resolvedProvider, env);
      const resolvedTools = tools || (taskType === "web_research" ? [{ type: "web_search" }] : undefined);

      if (!providers[resolvedProvider]) {
        throwModelConfigError(`AI provider is not configured: ${resolvedProvider}`);
      }

      if (!resolvedModel) {
        throwModelConfigError(`AI model is not configured for task: ${taskType}`);
      }

      if (!providerConfig.apiKey) {
        throwModelConfigError(`AI API key is not configured for provider: ${resolvedProvider}`);
      }

      return providers[resolvedProvider]({
        provider: resolvedProvider,
        model: resolvedModel,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        messages,
        responseFormat,
        tools: resolvedTools,
        temperature,
        requestId
      });
    }
  };
}

async function callModel(options) {
  return createAiGateway().callModel(options);
}

function throwModelConfigError(message) {
  throw appError("MODEL_NOT_CONFIGURED", "configuration", message, "configure_model");
}

module.exports = {
  callModel,
  createAiGateway
};
