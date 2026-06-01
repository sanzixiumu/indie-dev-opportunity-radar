const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeAnalysisPayload,
  normalizeAnswers,
  normalizeGeneratedProjectDraft,
  normalizeQuestionPayload,
  validateIdea,
} = require("../../cloudfunctions/_shared/validators/incubation");

test("validateIdea rejects blank ideas with validation contract", () => {
  assert.throws(
    () => validateIdea("  "),
    (error) => {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.type, "validation");
      assert.equal(error.action, "edit_input");
      assert.match(error.message, /项目灵感不能为空/);
      return true;
    },
  );
});

test("normalizeQuestionPayload normalizes valid payload with options", () => {
  const payload = normalizeQuestionPayload({
    initialAssessment: {
      summary: "用户想做 AI PRD 工具",
      missingInfo: ["目标用户", "变现偏好"],
      readyForResearch: false,
    },
    questions: [
      {
        questionId: "q1",
        title: "你最想服务谁？",
        description: "先明确第一批用户",
        type: "single",
        options: [
          {
            label: "独立开发者",
            value: "indie_developer",
          },
          {
            label: "小团队",
            value: "small_team",
          },
        ],
        allowCustomInput: true,
        isRequired: true,
      },
    ],
  });

  assert.deepEqual(payload, {
    initialAssessment: {
      summary: "用户想做 AI PRD 工具",
      missingInfo: ["目标用户", "变现偏好"],
      readyForResearch: false,
    },
    questions: [
      {
        questionId: "q1",
        title: "你最想服务谁？",
        description: "先明确第一批用户",
        type: "single",
        options: [
          {
            label: "独立开发者",
            value: "indie_developer",
          },
          {
            label: "小团队",
            value: "small_team",
          },
        ],
        allowCustomInput: true,
        isRequired: true,
      },
    ],
  });
});

test("normalizeQuestionPayload rejects choice questions without options or custom input", () => {
  assert.throws(
    () =>
      normalizeQuestionPayload({
        initialAssessment: {
          summary: "用户想做 AI PRD 工具",
          missingInfo: ["目标用户"],
          readyForResearch: false,
        },
        questions: [
          {
            questionId: "q1",
            title: "你最想服务谁？",
            description: "先明确第一批用户",
            type: "single",
            options: [],
            allowCustomInput: false,
            isRequired: true,
          },
        ],
      }),
    (error) => {
      assert.equal(error.code, "AI_OUTPUT_INVALID");
      assert.equal(error.type, "ai_output");
      assert.equal(error.action, "retry");
      assert.match(error.message, /必须提供选项/);
      return true;
    },
  );
});

test("normalizeQuestionPayload rejects empty questions with AI output contract", () => {
  assert.throws(
    () =>
      normalizeQuestionPayload({
        initialAssessment: {
          summary: "用户想做 AI PRD 工具",
          missingInfo: ["目标用户"],
          readyForResearch: false,
        },
        questions: [],
      }),
    (error) => {
      assert.equal(error.code, "AI_OUTPUT_INVALID");
      assert.equal(error.type, "ai_output");
      assert.equal(error.action, "retry");
      assert.match(error.message, /至少包含一个问题/);
      return true;
    },
  );
});

test("normalizeAnalysisPayload rejects malformed analysis with AI output contract", () => {
  assert.throws(
    () =>
      normalizeAnalysisPayload({
        conclusion: "建议做",
        limitedInfo: false,
        limitedInfoReason: "",
        domesticProducts: [],
        globalProducts: [],
        entryDirection: "先做垂直版本",
        advantages: [],
        risks: [],
        suggestions: [],
        researchSources: [],
      }),
    (error) => {
      assert.equal(error.code, "AI_OUTPUT_INVALID");
      assert.equal(error.type, "ai_output");
      assert.equal(error.action, "retry");
      assert.match(error.message, /title/);
      return true;
    },
  );
});

test("normalizeAnalysisPayload normalizes the full analysis contract", () => {
  const payload = normalizeAnalysisPayload({
    title: "AI PRD 生成助手",
    conclusion: "建议做，但先聚焦",
    limitedInfo: true,
    limitedInfoReason: "公开定价信息不足",
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
    entryDirection: "先做面向独立开发者的 PRD 草稿生成",
    advantages: ["低门槛"],
    risks: [
      {
        description: "头部产品可能覆盖基础能力",
        source: "竞品动态",
      },
    ],
    suggestions: [
      {
        priority: "P0",
        action: "访谈 5 个用户",
        expectedSignal: "3 人愿意试用",
      },
    ],
    researchSources: [
      {
        title: "竞品官网",
        url: "https://example.com",
        summary: "定位与定价",
      },
    ],
  });

  assert.deepEqual(payload, {
    title: "AI PRD 生成助手",
    conclusion: "建议做，但先聚焦",
    limitedInfo: true,
    limitedInfoReason: "公开定价信息不足",
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
    entryDirection: "先做面向独立开发者的 PRD 草稿生成",
    advantages: ["低门槛"],
    risks: [
      {
        description: "头部产品可能覆盖基础能力",
        source: "竞品动态",
      },
    ],
    suggestions: [
      {
        priority: "P0",
        action: "访谈 5 个用户",
        expectedSignal: "3 人愿意试用",
      },
    ],
    researchSources: [
      {
        title: "竞品官网",
        url: "https://example.com",
        summary: "定位与定价",
      },
    ],
  });
});

test("normalizeAnswers normalizes selected options and custom input", () => {
  const payload = normalizeAnswers([
    {
      questionId: " q1 ",
      questionTitle: " 目标用户是谁？ ",
      selectedOptions: [" 独立开发者 ", " 小团队 "],
      customInput: " 先服务小团队 ",
    },
  ]);

  assert.deepEqual(payload, [
    {
      questionId: "q1",
      questionTitle: "目标用户是谁？",
      selectedOptions: ["独立开发者", "小团队"],
      customInput: "先服务小团队",
    },
  ]);
});

test("normalizeAnswers rejects non-array answers with validation contract", () => {
  assert.throws(
    () => normalizeAnswers({ questionId: "q1" }),
    (error) => {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.type, "validation");
      assert.equal(error.action, "edit_input");
      assert.match(error.message, /answers 必须是数组/);
      return true;
    },
  );
});

test("normalizeAnswers rejects malformed answer objects with validation contract", () => {
  assert.throws(
    () =>
      normalizeAnswers([
        {
          questionId: "q1",
          questionTitle: "",
          selectedOptions: [],
        },
      ]),
    (error) => {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.type, "validation");
      assert.equal(error.action, "edit_input");
      assert.match(error.message, /answer.questionTitle/);
      return true;
    },
  );
});

test("normalizeGeneratedProjectDraft normalizes a full draft and defaults statuses", () => {
  const payload = normalizeGeneratedProjectDraft({
    id: "project-1",
    sourceIdea: "我想做 AI PRD 工具",
    answers: [
      {
        questionId: "q1",
        questionTitle: "目标用户是谁？",
        selectedOptions: ["独立开发者"],
        customInput: "小团队",
      },
    ],
    title: "AI PRD 生成助手",
    conclusion: "建议从垂直人群切入",
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
    entryDirection: "先做面向独立开发者的 PRD 草稿生成",
    advantages: ["低门槛"],
    risks: [
      {
        description: "同质化竞争",
        source: "竞品分析",
      },
    ],
    suggestions: [
      {
        priority: "P0",
        action: "先做落地页验证",
        expectedSignal: "20% 访客提交邮箱",
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
    createdAt: "2026-06-01T00:00:00.000Z",
  });

  assert.equal(payload.favoriteStatus, false);
  assert.equal(payload.compareStatus, false);
  assert.equal(payload.title, "AI PRD 生成助手");
  assert.equal(payload.limitedInfo, false);
  assert.equal(payload.limitedInfoReason, "");
  assert.deepEqual(payload.modelInfo, {
    reasoningProvider: "deepseek",
    reasoningModel: "deepseek-v4-pro",
    researchProvider: "doubao",
    researchModel: "doubao-seed",
  });
  assert.deepEqual(payload.suggestions, [
    {
      priority: "P0",
      action: "先做落地页验证",
      expectedSignal: "20% 访客提交邮箱",
    },
  ]);
  assert.deepEqual(payload.researchSources, [
    {
      title: "竞品官网",
      url: "https://example.com",
      summary: "产品能力",
    },
  ]);
});
