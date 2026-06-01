const cloud = require("wx-server-sdk");
const { createGeneratedProjectRepository } = require("./_shared/generated-projects");
const { createSaveGeneratedProject, createUserResolver } = require("./handler");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

function createId() {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createUserId() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const db = cloud.database();
const now = () => new Date().toISOString();

exports.main = createSaveGeneratedProject({
  getWXContext: () => cloud.getWXContext(),
  repo: createGeneratedProjectRepository({
    db,
    now,
    createId,
  }),
  resolveUserId: createUserResolver({
    db,
    now,
    createId: createUserId,
  }),
  now,
});
