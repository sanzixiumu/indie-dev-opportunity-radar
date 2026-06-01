const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createGenerateIncubationAnalysis,
} = require("../../cloudfunctions/generateIncubationAnalysis/handler");

function createAnswers() {
  return [
    {
      questionId: "q_target_user",
      questionTitle: "你最想服务谁？",
      selectedOptions: ["独立开发者"],
      customInput: "先服务需要快速写 PRD 的小团队",
    },
  ];
}

function createAnalysisPayload() {
  return {
    title: "AI PRD 生成助手",
    conclusion: "建议先聚焦独立开发者的轻量 PRD 草稿生成。",
    limitedInfo: false,
    limitedInfoReason: "",
    domesticProducts: [
      {
        name: "扣子",
        positioning: "AI Bot 与工作流平台",
        strengths: "生态和模型能力完善",
        weaknesses: "对 PRD 场景的垂直模板不足",
        evidence: "官网能力说明",
      },
    ],
    globalProducts: [
      {
        name: "Notion AI",
        positioning: "知识管理与写作助手",
        strengths: "用户基础大",
        weaknesses: "项目验证链路不够垂直",
        evidence: "产品页说明",
      },
    ],
    entryDirection: "先做面向独立开发者的 PRD 草稿和验证清单生成",
    advantages: ["用户路径清晰", "可快速验证付费意愿"],
    risks: [
      {
        description: "通用 AI 写作产品可能覆盖基础 PRD 能力",
        source: "竞品强度",
      },
    ],
    suggestions: [
      {
        priority: "P0",
        action: "访谈 5 个独立开发者并生成试用稿",
        expectedSignal: "至少 3 人愿意继续使用",
      },
    ],
    researchSources: [
      {
        title: "竞品官网",
        url: "https://example.com",
        summary: "用于判断竞品定位和能力边界",
      },
    ],
  };
}

test("returns validation error response for invalid answers", async () => {
  const main = createGenerateIncubationAnalysis({
    gateway: {
      async callModel() {
        throw new Error("callModel should not be called");
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
  });

  const result = await main(
    {
      idea: "我想做 AI PRD 工具",
      answers: "not answers",
    },
    {},
  );

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      type: "validation",
      message: "answers 必须是数组",
      action: "edit_input",
    },
    request_id: "req_20260601120000000",
  });
});

test("returns structured project with modelInfo and risk source", async () => {
  const calls = [];
  const analysis = createAnalysisPayload();
  const answers = createAnswers();
  const main = createGenerateIncubationAnalysis({
    gateway: {
      async callModel(options) {
        calls.push(options);
        return {
          provider: "doubao",
          model: "doubao-seed-search",
          text: JSON.stringify(analysis),
        };
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
    reasoningModelInfo: {
      provider: "unit-reasoning",
      model: "unit-reasoning-model",
    },
  });

  const result = await main(
    {
      idea: " 我想做 AI PRD 工具 ",
      answers,
      provider: "doubao",
      model: "doubao-seed-search",
    },
    {},
  );

  assert.equal(result.ok, true);
  assert.equal(result.request_id, "req_20260601120000000");
  assert.deepEqual(result.data.project, {
    sourceIdea: "我想做 AI PRD 工具",
    answers,
    ...analysis,
    modelInfo: {
      reasoningProvider: "unit-reasoning",
      reasoningModel: "unit-reasoning-model",
      researchProvider: "doubao",
      researchModel: "doubao-seed-search",
    },
    favoriteStatus: false,
    compareStatus: false,
  });
  assert.equal(result.data.project.risks[0].source, "竞品强度");
  assert.equal(calls.length, 1);
  assert.match(calls[0].messages[0].content, /我想做 AI PRD 工具/);
  assert.match(calls[0].messages[0].content, /独立开发者/);
});

test("returns AI_OUTPUT_INVALID when model returns invalid JSON", async () => {
  const main = createGenerateIncubationAnalysis({
    gateway: {
      async callModel() {
        return {
          provider: "doubao",
          model: "doubao-seed-search",
          text: "not json",
        };
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
  });

  const result = await main(
    {
      idea: "我想做 AI PRD 工具",
      answers: createAnswers(),
    },
    {},
  );

  assert.equal(result.ok, false);
  assert.equal(result.request_id, "req_20260601120000000");
  assert.deepEqual(result.error, {
    code: "AI_OUTPUT_INVALID",
    type: "ai_output",
    message: "AI 输出不是合法 JSON",
    action: "retry",
  });
});

test("gateway call uses web research options", async () => {
  const calls = [];
  const main = createGenerateIncubationAnalysis({
    gateway: {
      async callModel(options) {
        calls.push(options);
        return {
          provider: "doubao",
          model: "doubao-seed-search",
          text: JSON.stringify(createAnalysisPayload()),
        };
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
  });

  await main(
    {
      idea: "我想做 AI PRD 工具",
      answers: createAnswers(),
      provider: "doubao",
      model: "doubao-seed-search",
    },
    {},
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].taskType, "web_research");
  assert.equal(calls[0].provider, "doubao");
  assert.equal(calls[0].model, "doubao-seed-search");
  assert.deepEqual(calls[0].tools, [{ type: "web_search" }]);
  assert.deepEqual(calls[0].responseFormat, { type: "json_object" });
  assert.equal(calls[0].temperature, 0.1);
  assert.equal(calls[0].requestId, "req_20260601120000000");
  assert.deepEqual(calls[0].messages, [
    {
      role: "user",
      content: calls[0].messages[0].content,
    },
  ]);
});
