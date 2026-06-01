const cloud = require("wx-server-sdk");
const { createAiGateway } = require("./_shared/ai-gateway");
const { createGenerateIncubationAnalysis } = require("./handler");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

exports.main = createGenerateIncubationAnalysis({
  gateway: createAiGateway(),
  now: () => new Date().toISOString(),
  reasoningModelInfo: {
    provider: process.env.AI_REASONING_PROVIDER || process.env.AI_PROVIDER || "deepseek",
    model: process.env.AI_REASONING_MODEL || process.env.AI_MODEL || "deepseek-v4-pro",
  },
});
