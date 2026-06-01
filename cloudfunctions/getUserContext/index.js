const cloud = require("wx-server-sdk");
const { createGetUserContext } = require("./handler");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

function createId() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** @type {Parameters<typeof createGetUserContext>[0]["db"]} */
const db = /** @type {Parameters<typeof createGetUserContext>[0]["db"]} */ (cloud.database());

exports.main = createGetUserContext({
  db,
  getWXContext: () => cloud.getWXContext(),
  now: () => new Date().toISOString(),
  createId
});
