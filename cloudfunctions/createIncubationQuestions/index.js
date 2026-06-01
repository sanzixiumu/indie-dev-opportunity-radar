const cloud = require("wx-server-sdk");
const { createAiGateway } = require("./_shared/ai-gateway");
const { createCreateIncubationQuestions } = require("./handler");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

function createId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

exports.main = createCreateIncubationQuestions({
  gateway: createAiGateway(),
  now: () => new Date().toISOString(),
  createId,
});
