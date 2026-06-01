const assert = require("node:assert/strict");
const test = require("node:test");

const { createGetUserContext } = require("../handler");

function createCollection(records, writes) {
  return {
    where(query) {
      return {
        async get() {
          return {
            data: records.filter((record) =>
              Object.entries(query).every(([key, value]) => record[key] === value)
            )
          };
        },
        async update({ data }) {
          const matchedRecords = records.filter((record) =>
            Object.entries(query).every(([key, value]) => record[key] === value)
          );

          for (const record of matchedRecords) {
            Object.assign(record, data);
          }

          return {
            updated: matchedRecords.length
          };
        }
      };
    },
    async add({ data }) {
      writes.push(data);
      return {
        _id: `doc_${writes.length}`
      };
    }
  };
}

function createDb(recordsByCollection, writesByCollection = {}) {
  return {
    collection(name) {
      if (!writesByCollection[name]) {
        writesByCollection[name] = [];
      }

      return createCollection(recordsByCollection[name] || [], writesByCollection[name]);
    }
  };
}

test("returns the existing user context without creating a duplicate user", async () => {
  const writesByCollection = {};
  const db = createDb({
    users: [
      {
        user_id: "user_existing",
        openid: "openid_123",
        membership_type: "free",
        membership_expired_at: null,
        created_at: "2026-06-01T00:00:00.000Z",
        updated_at: "2026-06-01T00:00:00.000Z"
      }
    ]
  }, writesByCollection);

  const main = createGetUserContext({
    db,
    getWXContext: () => ({
      OPENID: "openid_123",
      APPID: "app_123",
      UNIONID: "union_123"
    }),
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "user_new"
  });

  const result = await main({}, {});

  assert.equal(result.ok, true);
  assert.equal(result.data.openid, "openid_123");
  assert.equal(result.data.appid, "app_123");
  assert.equal(result.data.unionid, "union_123");
  assert.equal(result.data.user.user_id, "user_existing");
  assert.equal(result.data.membership.plan_type, "free");
  assert.equal(result.data.quota_summary.daily_recommend_limit, 3);
  assert.equal(result.data.quota_summary.monthly_generate_limit, 1);
  assert.deepEqual(writesByCollection.users || [], []);
});

test("updates last login time for an existing user", async () => {
  const existingUser = {
    user_id: "user_existing",
    openid: "openid_123",
    membership_type: "free",
    membership_expired_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    last_login_at: "2026-06-01T00:00:00.000Z"
  };
  const db = createDb({
    users: [existingUser]
  });

  const main = createGetUserContext({
    db,
    getWXContext: () => ({
      OPENID: "openid_123",
      APPID: "app_123"
    }),
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "user_new"
  });

  const result = await main({}, {});

  assert.equal(result.ok, true);
  assert.equal(existingUser.last_login_at, "2026-06-01T12:00:00.000Z");
  assert.equal(existingUser.updated_at, "2026-06-01T12:00:00.000Z");
});

test("creates a free user when openid is seen for the first time", async () => {
  const writesByCollection = {};
  const db = createDb({ users: [] }, writesByCollection);

  const main = createGetUserContext({
    db,
    getWXContext: () => ({
      OPENID: "openid_first",
      APPID: "app_123"
    }),
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "user_created"
  });

  const result = await main({}, {});

  assert.equal(result.ok, true);
  assert.equal(result.data.user.user_id, "user_created");
  assert.equal(result.data.user.openid, "openid_first");
  assert.equal(result.data.membership.plan_type, "free");
  assert.equal(result.data.quota_summary.daily_recommend_limit, 3);
  assert.equal(result.data.quota_summary.monthly_generate_limit, 1);
  assert.deepEqual(writesByCollection.users, [
    {
      user_id: "user_created",
      openid: "openid_first",
      membership_type: "free",
      membership_expired_at: null,
      created_at: "2026-06-01T12:00:00.000Z",
      updated_at: "2026-06-01T12:00:00.000Z",
      last_login_at: "2026-06-01T12:00:00.000Z"
    }
  ]);
});
