const cloud = require("wx-server-sdk");
const { createGeneratedProjectRepository } = require("./_shared/generated-projects");
const { createSaveGeneratedProject } = require("./handler");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

function createId() {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

exports.main = createSaveGeneratedProject({
  getWXContext: () => cloud.getWXContext(),
  repo: createGeneratedProjectRepository({
    db: cloud.database(),
    now: () => new Date().toISOString(),
    createId,
  }),
  now: () => new Date().toISOString(),
});
