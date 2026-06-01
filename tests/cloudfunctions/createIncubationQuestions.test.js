const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createCreateIncubationQuestions,
} = require("../../cloudfunctions/createIncubationQuestions/handler");

function createQuestionPayload() {
  return {
    initialAssessment: {
      summary: "用户想做 AI PRD 工具",
      missingInfo: ["目标用户", "变现偏好"],
      readyForResearch: false,
    },
    questions: [
      {
        questionId: "q_target_user",
        title: "你最想服务谁？",
        description: "先明确第一批用户",
        type: "single",
        options: [
          {
            label: "独立开发者",
            value: "indie_developer",
          },
        ],
        allowCustomInput: true,
        isRequired: true,
      },
    ],
  };
}

test("returns validation error response for empty idea", async () => {
  const main = createCreateIncubationQuestions({
    gateway: {
      async callModel() {
        throw new Error("callModel should not be called");
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "session_test",
  });

  const result = await main({ idea: "  " }, {});

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      type: "validation",
      message: "项目灵感不能为空，请先输入一个想法",
      action: "edit_input",
    },
    request_id: "req_20260601120000000",
  });
});

test("returns generated question payload and modelInfo", async () => {
  const calls = [];
  const payload = createQuestionPayload();
  const main = createCreateIncubationQuestions({
    gateway: {
      async callModel(options) {
        calls.push(options);
        return {
          provider: "deepseek",
          model: "deepseek-v4-pro",
          text: JSON.stringify(payload),
        };
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "session_abc",
  });

  const result = await main(
    {
      idea: "我想做 AI PRD 工具",
      provider: "deepseek",
      model: "deepseek-v4-pro",
    },
    {},
  );

  assert.equal(result.ok, true);
  assert.equal(result.request_id, "req_20260601120000000");
  assert.deepEqual(result.data, {
    session_id: "session_abc",
    initialAssessment: payload.initialAssessment,
    questions: payload.questions,
    modelInfo: {
      reasoningProvider: "deepseek",
      reasoningModel: "deepseek-v4-pro",
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].taskType, "reasoning");
  assert.equal(calls[0].provider, "deepseek");
  assert.equal(calls[0].model, "deepseek-v4-pro");
  assert.deepEqual(calls[0].messages, [
    {
      role: "user",
      content: calls[0].messages[0].content,
    },
  ]);
  assert.match(calls[0].messages[0].content, /我想做 AI PRD 工具/);
  assert.deepEqual(calls[0].responseFormat, { type: "json_object" });
  assert.equal(calls[0].temperature, 0.2);
  assert.equal(calls[0].requestId, "req_20260601120000000");
});

test("returns AI_OUTPUT_INVALID when model returns invalid JSON", async () => {
  const main = createCreateIncubationQuestions({
    gateway: {
      async callModel() {
        return {
          provider: "deepseek",
          model: "deepseek-v4-pro",
          text: "not json",
        };
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "session_invalid",
  });

  const result = await main({ idea: "我想做 AI PRD 工具" }, {});

  assert.equal(result.ok, false);
  assert.equal(result.request_id, "req_20260601120000000");
  assert.deepEqual(result.error, {
    code: "AI_OUTPUT_INVALID",
    type: "ai_output",
    message: "AI 输出不是合法 JSON",
    action: "retry",
  });
});

test("returns AI_OUTPUT_INVALID when model returns empty questions", async () => {
  const payload = createQuestionPayload();
  payload.questions = [];
  const main = createCreateIncubationQuestions({
    gateway: {
      async callModel() {
        return {
          provider: "deepseek",
          model: "deepseek-v4-pro",
          text: JSON.stringify(payload),
        };
      },
    },
    now: () => "2026-06-01T12:00:00.000Z",
    createId: () => "session_invalid",
  });

  const result = await main({ idea: "我想做 AI PRD 工具" }, {});

  assert.equal(result.ok, false);
  assert.equal(result.request_id, "req_20260601120000000");
  assert.deepEqual(result.error, {
    code: "AI_OUTPUT_INVALID",
    type: "ai_output",
    message: "questions 必须至少包含一个问题",
    action: "retry",
  });
});
