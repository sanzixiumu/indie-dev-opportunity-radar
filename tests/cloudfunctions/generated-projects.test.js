const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createGeneratedProjectRepository,
  mapDocumentToProject,
  mapProjectToDocument,
} = require("../../cloudfunctions/_shared/generated-projects");

function sampleProject(overrides = {}) {
  return {
    id: overrides.id || "project-1",
    sourceIdea: "我想做一个帮独立开发者找项目方向的小工具",
    answers: [
      {
        questionId: "q1",
        questionTitle: "目标用户是谁？",
        selectedOptions: ["独立开发者"],
        customInput: "先服务小团队",
      },
    ],
    title: overrides.title || "独立开发者灵感雷达",
    conclusion: "建议做，但需要从细分场景切入。",
    limitedInfo: false,
    limitedInfoReason: "",
    domesticProducts: [
      {
        name: "扣子",
        positioning: "AI Bot 平台",
        strengths: "生态完善",
        weaknesses: "垂直深度不足",
        evidence: "官网能力说明",
      },
    ],
    globalProducts: [
      {
        name: "Notion AI",
        positioning: "知识管理 AI",
        strengths: "用户基础大",
        weaknesses: "项目决策深度有限",
        evidence: "产品页说明",
      },
    ],
    entryDirection: "先做轻量项目方向评估工具。",
    advantages: ["适合小团队快速验证"],
    risks: [{ description: "竞品强", source: "同类 AI 工具已有成熟产品" }],
    suggestions: [
      {
        priority: "P0",
        action: "先访谈 5 个独立开发者",
        expectedSignal: "3 人愿意试用",
      },
    ],
    researchSources: [
      {
        title: "竞品官网",
        url: "https://example.com",
        summary: "产品能力",
      },
    ],
    modelInfo: {
      reasoningProvider: "deepseek",
      reasoningModel: "deepseek-v4-pro",
      researchProvider: "doubao",
      researchModel: "doubao-seed",
    },
    createdAt: overrides.createdAt || "2026-06-01T00:00:00.000Z",
    favoriteStatus: overrides.favoriteStatus || false,
    compareStatus: overrides.compareStatus || false,
  };
}

function createDb(recordsByCollection, writesByCollection = {}) {
  return {
    collection(name) {
      if (!writesByCollection[name]) {
        writesByCollection[name] = [];
      }

      return {
        where(query) {
          let chain = recordsByCollection[name].filter((record) =>
            Object.entries(query).every(([key, value]) => record[key] === value),
          );

          return {
            orderBy(field, direction) {
              chain = chain.toSorted((left, right) => {
                if (left[field] === right[field]) {
                  return 0;
                }

                const result = left[field] > right[field] ? 1 : -1;
                return direction === "desc" ? -result : result;
              });

              return this;
            },
            skip(offset) {
              chain = chain.slice(offset);
              return this;
            },
            limit(size) {
              chain = chain.slice(0, size);
              return this;
            },
            async count() {
              return {
                total: recordsByCollection[name].filter((record) =>
                  Object.entries(query).every(([key, value]) => record[key] === value),
                ).length,
              };
            },
            async get() {
              return {
                data: chain,
              };
            },
          };
        },
        async add({ data }) {
          writesByCollection[name].push(data);
          return {
            _id: `doc_${writesByCollection[name].length}`,
          };
        },
      };
    },
  };
}

function assertAppError(error, { code, type, action }) {
  assert.equal(error.code, code);
  assert.equal(error.type, type);
  assert.equal(error.action, action);
  return true;
}

test("mapProjectToDocument maps camelCase draft to snake_case generated_assets document", () => {
  const doc = mapProjectToDocument({
    project: sampleProject(),
    assetId: "asset-1",
    openid: "openid-1",
    userId: "user-1",
    now: () => "2026-06-01T12:00:00.000Z",
  });

  assert.equal(doc.asset_id, "asset-1");
  assert.equal(doc.asset_type, "incubated_project");
  assert.equal(doc.owner_openid, "openid-1");
  assert.equal(doc.owner_user_id, "user-1");
  assert.equal(doc.user_id, undefined);
  assert.equal(doc.status, "active");
  assert.equal(doc.source_idea, "我想做一个帮独立开发者找项目方向的小工具");
  assert.equal(doc.entry_direction, "先做轻量项目方向评估工具。");
  assert.equal(doc.favorite_status, false);
  assert.equal(doc.compare_status, false);
  assert.equal(doc.model_info.research_provider, "doubao");
  assert.equal(doc.created_at, "2026-06-01T00:00:00.000Z");
  assert.equal(doc.updated_at, "2026-06-01T12:00:00.000Z");
});

test("mapDocumentToProject maps snake_case doc to camelCase project", () => {
  const project = mapDocumentToProject({
    _id: "doc-1",
    asset_id: "asset-1",
    source_idea: "我想做 AI PRD 工具",
    answers: [],
    title: "AI PRD 生成助手",
    conclusion: "建议从垂直人群切入",
    limited_info: true,
    limited_info_reason: "公开定价信息不足",
    domestic_products: [],
    global_products: [],
    entry_direction: "先做垂直版本",
    advantages: ["低门槛"],
    risks: [],
    suggestions: [],
    research_sources: [],
    model_info: {
      reasoning_provider: "deepseek",
      reasoning_model: "deepseek-v4-pro",
      research_provider: "doubao",
      research_model: "doubao-seed",
    },
    created_at: "2026-06-01T00:00:00.000Z",
    favorite_status: true,
    compare_status: false,
  });

  assert.equal(project.id, "asset-1");
  assert.equal(project.sourceIdea, "我想做 AI PRD 工具");
  assert.equal(project.entryDirection, "先做垂直版本");
  assert.equal(project.limitedInfo, true);
  assert.equal(project.limitedInfoReason, "公开定价信息不足");
  assert.equal(project.modelInfo.researchProvider, "doubao");
  assert.equal(project.favoriteStatus, true);
  assert.equal(project.compareStatus, false);
});

test("listProjects returns only current user's active incubated_project docs newest first and paginated", async () => {
  const db = createDb({
    generated_assets: [
      {
        asset_id: "asset-old",
        asset_type: "incubated_project",
        owner_openid: "openid-1",
        status: "active",
        title: "Old",
        source_idea: "old idea",
        answers: [],
        conclusion: "old conclusion",
        limited_info: false,
        limited_info_reason: "",
        domestic_products: [],
        global_products: [],
        entry_direction: "old entry",
        advantages: ["old advantage"],
        risks: [],
        suggestions: [],
        research_sources: [],
        model_info: {
          reasoning_provider: "deepseek",
          reasoning_model: "deepseek-v4-pro",
          research_provider: "doubao",
          research_model: "doubao-seed",
        },
        created_at: "2026-06-01T00:00:00.000Z",
      },
      {
        asset_id: "asset-other-user",
        asset_type: "incubated_project",
        owner_openid: "openid-2",
        status: "active",
        created_at: "2026-06-01T03:00:00.000Z",
      },
      {
        asset_id: "asset-inactive",
        asset_type: "incubated_project",
        owner_openid: "openid-1",
        status: "deleted",
        created_at: "2026-06-01T04:00:00.000Z",
      },
      {
        asset_id: "asset-new",
        asset_type: "incubated_project",
        owner_openid: "openid-1",
        status: "active",
        title: "New",
        source_idea: "new idea",
        answers: [],
        conclusion: "new conclusion",
        limited_info: false,
        limited_info_reason: "",
        domestic_products: [],
        global_products: [],
        entry_direction: "new entry",
        advantages: ["new advantage"],
        risks: [],
        suggestions: [],
        research_sources: [],
        model_info: {
          reasoning_provider: "deepseek",
          reasoning_model: "deepseek-v4-pro",
          research_provider: "doubao",
          research_model: "doubao-seed",
        },
        created_at: "2026-06-01T02:00:00.000Z",
      },
      {
        asset_id: "asset-middle",
        asset_type: "incubated_project",
        owner_openid: "openid-1",
        status: "active",
        title: "Middle",
        source_idea: "middle idea",
        answers: [],
        conclusion: "middle conclusion",
        limited_info: false,
        limited_info_reason: "",
        domestic_products: [],
        global_products: [],
        entry_direction: "middle entry",
        advantages: ["middle advantage"],
        risks: [],
        suggestions: [],
        research_sources: [],
        model_info: {
          reasoning_provider: "deepseek",
          reasoning_model: "deepseek-v4-pro",
          research_provider: "doubao",
          research_model: "doubao-seed",
        },
        created_at: "2026-06-01T01:00:00.000Z",
      },
    ],
  });

  const repository = createGeneratedProjectRepository({
    db,
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "asset-created",
  });

  const result = await repository.listProjects({
    openid: "openid-1",
    page: 2,
    pageSize: 2,
  });

  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 2);
  assert.equal(result.total, 3);
  assert.deepEqual(
    result.items.map((project) => project.id),
    ["asset-old"],
  );
});

test("saveProject requires openid and maps database failures", async () => {
  const repository = createGeneratedProjectRepository({
    db: {
      collection() {
        return {
          async add() {
            throw new Error("database unavailable");
          },
        };
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "asset-created",
  });

  await assert.rejects(
    () => repository.saveProject({ userId: "user-1", project: sampleProject() }),
    (error) =>
      assertAppError(error, {
        code: "UNAUTHENTICATED",
        type: "authentication",
        action: "login",
      }),
  );

  await assert.rejects(
    () =>
      repository.saveProject({
        openid: "openid-1",
        userId: "user-1",
        project: sampleProject(),
      }),
    (error) =>
      assertAppError(error, {
        code: "DATABASE_WRITE_FAILED",
        type: "database",
        action: "retry",
      }),
  );
});

test("listProjects returns NOT_FOUND when requested asset is unavailable", async () => {
  const repository = createGeneratedProjectRepository({
    db: createDb({ generated_assets: [] }),
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "asset-created",
  });

  await assert.rejects(
    () =>
      repository.listProjects({
        openid: "openid-1",
        assetId: "missing-asset",
      }),
    (error) =>
      assertAppError(error, {
        code: "NOT_FOUND",
        type: "permission",
        action: "retry",
      }),
  );
});
