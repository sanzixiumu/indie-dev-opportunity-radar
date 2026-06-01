const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createSaveGeneratedProject,
  createUserResolver,
} = require("../../cloudfunctions/saveGeneratedProject/handler");

function sampleProject() {
  return {
    title: "AI PRD 生成助手",
    sourceIdea: "我想做 AI PRD 工具",
  };
}

function createCollection(records, writes) {
  return {
    where(query) {
      return {
        async get() {
          return {
            data: records.filter((record) =>
              Object.entries(query).every(([key, value]) => record[key] === value),
            ),
          };
        },
      };
    },
    async add({ data }) {
      writes.push(data);
      return {
        _id: `doc_${writes.length}`,
      };
    },
  };
}

function createDb(recordsByCollection, writesByCollection = {}) {
  return {
    collection(name) {
      if (!writesByCollection[name]) {
        writesByCollection[name] = [];
      }

      return createCollection(recordsByCollection[name] || [], writesByCollection[name]);
    },
  };
}

test("save rejects unauthenticated requests", async () => {
  let repoCalled = false;
  const main = createSaveGeneratedProject({
    getWXContext: () => ({}),
    repo: {
      async saveProject() {
        repoCalled = true;
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
  });

  const result = await main({ project: sampleProject() }, {});

  assert.equal(repoCalled, false);
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "UNAUTHENTICATED",
      type: "authentication",
      message: "未获取到用户身份",
      action: "login",
    },
    request_id: "req_20260601120000000",
  });
});

test("save passes openid and project to repo and returns asset", async () => {
  const calls = [];
  const project = sampleProject();
  const savedProject = {
    id: "asset_saved",
    ...project,
  };
  const main = createSaveGeneratedProject({
    getWXContext: () => ({ OPENID: "openid-1" }),
    repo: {
      async saveProject(options) {
        calls.push(options);
        return savedProject;
      },
    },
    resolveUserId: async () => "user-1",
    now: () => "2026-06-01T12:00:00.000Z",
  });

  const result = await main({ project }, {});

  assert.deepEqual(calls, [
    {
      openid: "openid-1",
      userId: "user-1",
      project,
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    data: {
      project: savedProject,
    },
    request_id: "req_20260601120000000",
  });
});

test("user resolver uses existing canonical user_id", async () => {
  const writesByCollection = {};
  const db = createDb(
    {
      users: [
        {
          user_id: "user-existing",
          openid: "openid-1",
        },
      ],
    },
    writesByCollection,
  );
  const resolveUserId = createUserResolver({
    db,
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "user-created",
  });

  const userId = await resolveUserId("openid-1");

  assert.equal(userId, "user-existing");
  assert.deepEqual(writesByCollection.users || [], []);
});

test("user resolver creates minimal free user when openid has no users record", async () => {
  const writesByCollection = {};
  const db = createDb({ users: [] }, writesByCollection);
  const resolveUserId = createUserResolver({
    db,
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "user-created",
  });

  const userId = await resolveUserId("openid-1");

  assert.equal(userId, "user-created");
  assert.deepEqual(writesByCollection.users, [
    {
      user_id: "user-created",
      openid: "openid-1",
      membership_type: "free",
      membership_expired_at: null,
      created_at: "2026-06-01T12:00:00.000Z",
      updated_at: "2026-06-01T12:00:00.000Z",
      last_login_at: "2026-06-01T12:00:00.000Z",
    },
  ]);
});
