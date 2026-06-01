const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createSaveGeneratedProject,
} = require("../../cloudfunctions/saveGeneratedProject/handler");

function sampleProject() {
  return {
    title: "AI PRD 生成助手",
    sourceIdea: "我想做 AI PRD 工具",
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
    now: () => "2026-06-01T12:00:00.000Z",
  });

  const result = await main({ project }, {});

  assert.deepEqual(calls, [
    {
      openid: "openid-1",
      userId: "",
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
