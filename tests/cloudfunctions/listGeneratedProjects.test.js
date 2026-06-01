const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createListGeneratedProjects,
} = require("../../cloudfunctions/listGeneratedProjects/handler");

test("list rejects unauthenticated requests", async () => {
  let repoCalled = false;
  const main = createListGeneratedProjects({
    getWXContext: () => ({}),
    repo: {
      async listProjects() {
        repoCalled = true;
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
  });

  const result = await main({}, {});

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

test("list passes openid pageSize and assetId to repo and returns items", async () => {
  const calls = [];
  const repositoryResult = {
    items: [
      {
        id: "asset-1",
        title: "AI PRD 生成助手",
      },
    ],
    page: 2,
    pageSize: 10,
    total: 24,
  };
  const main = createListGeneratedProjects({
    getWXContext: () => ({ OPENID: "openid-1" }),
    repo: {
      async listProjects(options) {
        calls.push(options);
        return repositoryResult;
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
  });

  const result = await main(
    {
      asset_id: "asset-1",
      page: 2,
      page_size: 10,
    },
    {},
  );

  assert.deepEqual(calls, [
    {
      openid: "openid-1",
      assetId: "asset-1",
      page: 2,
      pageSize: 10,
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    data: repositoryResult,
    request_id: "req_20260601120000000",
  });
});
