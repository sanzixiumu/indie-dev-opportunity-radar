# Tab1 Workspace AI Backend Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real-model Tab1 idea incubation flow and Tab4 workspace backend loop using CloudBase functions, DeepSeek reasoning, Doubao web research, typed errors, and user-owned generated assets.

**Architecture:** Add a shared cloud-function foundation for typed responses, prompt templates, validation, model routing, and generated-project persistence. Create four Event Functions for question generation, analysis generation, saving projects, and listing projects. Update the Mini Program pages to call those functions, render the full incubation flow, save confirmed results, and show workspace details without re-running models.

**Tech Stack:** WeChat Mini Program, CloudBase Event Functions, `wx-server-sdk`, CommonJS, native `node:test`, TDesign Mini Program components, DeepSeek Chat Completions, Volcengine Ark / Doubao Responses API with `web_search`.

---

## Scope Check

This spec spans backend model routing, generated-asset persistence, and two Mini Program pages, but all pieces serve one testable vertical slice: "idea -> questions -> research result -> save -> workspace detail." Keep the first implementation focused on that loop. Do not implement PRD generation, comparison reports, payments, or user-facing model selection in this plan.

## File Structure

- Create `cloudfunctions/_shared/response.js`: request IDs, success responses, typed error responses, and safe exception mapping.
- Create `cloudfunctions/_shared/env.js`: reads task routing and provider environment variables.
- Create `cloudfunctions/_shared/prompts/incubation.js`: the two approved prompt templates and render helpers.
- Create `cloudfunctions/_shared/validators/incubation.js`: lightweight validation and normalization for question/result/project payloads.
- Create `cloudfunctions/_shared/ai-gateway/index.js`: `callModel()` task router with injectable provider clients for tests.
- Create `cloudfunctions/_shared/ai-gateway/providers/deepseek.js`: DeepSeek Chat Completions client.
- Create `cloudfunctions/_shared/ai-gateway/providers/doubao.js`: Volcengine Ark Responses API client using `web_search`.
- Create `cloudfunctions/_shared/generated-projects.js`: database mapping and generated asset helpers.
- Create `scripts/sync-cloud-shared.js`: copies `cloudfunctions/_shared` into each business cloud function as `./_shared` for deployment safety.
- Create `cloudfunctions/createIncubationQuestions/`: Event Function for DeepSeek follow-up questions.
- Create `cloudfunctions/generateIncubationAnalysis/`: Event Function for Doubao web research result generation.
- Create `cloudfunctions/saveGeneratedProject/`: Event Function for user-confirmed generated project saving.
- Create `cloudfunctions/listGeneratedProjects/`: Event Function for recent items, workspace list, and detail lookup.
- Create `lib/cloud-functions.js`: Mini Program wrapper around `wx.cloud.callFunction` with typed-error normalization.
- Modify `.env.example`: add AI task-routing, DeepSeek, and Ark/Doubao comments.
- Modify local `.env`: add the same empty Ark/Doubao placeholders and comments; do not add real keys.
- Modify `pages/find/index.js`, `pages/find/index.wxml`, `pages/find/index.wxss`: Tab1 real backend incubation flow.
- Modify `pages/workspace/index.js`, `pages/workspace/index.wxml`, `pages/workspace/index.wxss`: Tab4 generated-project list and detail.
- Create tests under `tests/cloudfunctions/` for shared modules and cloud function handlers.

---

### Task 1: Environment Routing Comments

**Files:**
- Modify: `.env.example`
- Modify: `.env`

- [ ] **Step 1: Update `.env.example`**

Insert this block under the existing `# AI Providers` heading, before the legacy `AI_PROVIDER` block:

```env
# Task-specific AI routing.
# Reasoning is used for follow-up questions and structured thinking.
AI_REASONING_PROVIDER=deepseek
AI_REASONING_MODEL=deepseek-v4-pro

# Web research is used for product/company search and market evidence.
# Use a Volcengine Ark / Doubao model that supports Responses API web_search.
AI_WEB_RESEARCH_PROVIDER=doubao
AI_WEB_RESEARCH_MODEL=
```

Insert this block after the DeepSeek settings:

```env
# Volcengine Ark / Doubao.
# Used by AI_WEB_RESEARCH_PROVIDER=doubao.
# Fill ARK_API_KEY and AI_WEB_RESEARCH_MODEL locally and in cloud function env vars.
ARK_API_KEY=
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

- [ ] **Step 2: Update local `.env` with empty placeholders only**

Add the same variables and comments to `.env`. Preserve any existing real keys already present. Leave new `ARK_API_KEY` and `AI_WEB_RESEARCH_MODEL` empty for the user to fill.

- [ ] **Step 3: Verify no secrets are staged**

Run:

```bash
git diff -- .env.example .env
```

Expected: `.env.example` shows comments and empty placeholders. `.env` may show comments and empty placeholders only for newly added variables. Do not commit `.env`.

- [ ] **Step 4: Commit tracked environment docs**

Run:

```bash
git add .env.example
git commit -m "docs: add AI task routing env placeholders"
```

Expected: commit succeeds with only `.env.example` staged.

---

### Task 2: Shared Typed Responses

**Files:**
- Create: `cloudfunctions/_shared/response.js`
- Create: `tests/cloudfunctions/shared-response.test.js`

- [ ] **Step 1: Write failing typed-response tests**

Create `tests/cloudfunctions/shared-response.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createRequestId,
  okResponse,
  errorResponse,
  normalizeError
} = require("../../cloudfunctions/_shared/response");

test("creates stable request ids from ISO timestamps", () => {
  assert.equal(createRequestId(() => "2026-06-01T12:34:56.789Z"), "req_20260601123456789");
});

test("wraps success payloads with request id", () => {
  assert.deepEqual(okResponse({ value: 1 }, "req_1"), {
    ok: true,
    data: { value: 1 },
    request_id: "req_1"
  });
});

test("wraps typed errors for frontend handling", () => {
  assert.deepEqual(
    errorResponse({
      code: "MODEL_NOT_CONFIGURED",
      type: "configuration",
      message: "调研模型未配置",
      action: "configure_model",
      requestId: "req_2"
    }),
    {
      ok: false,
      error: {
        code: "MODEL_NOT_CONFIGURED",
        type: "configuration",
        message: "调研模型未配置",
        action: "configure_model"
      },
      request_id: "req_2"
    }
  );
});

test("normalizes unknown exceptions without leaking internals", () => {
  const result = normalizeError(new Error("secret stack"), "req_3");

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "UNKNOWN_ERROR");
  assert.equal(result.error.type, "unknown");
  assert.equal(result.error.action, "contact_support");
  assert.equal(result.request_id, "req_3");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/cloudfunctions/shared-response.test.js
```

Expected: FAIL with `Cannot find module '../../cloudfunctions/_shared/response'`.

- [ ] **Step 3: Implement shared typed responses**

Create `cloudfunctions/_shared/response.js`:

```js
const KNOWN_ERROR_TYPES = new Set([
  "configuration",
  "authentication",
  "validation",
  "quota",
  "ai_generation",
  "ai_output",
  "database",
  "permission",
  "network",
  "unknown"
]);

function createRequestId(now) {
  return `req_${now().replace(/[-:.TZ]/g, "")}`;
}

function okResponse(data, requestId) {
  return {
    ok: true,
    data,
    request_id: requestId
  };
}

function errorResponse({ code, type, message, action, requestId }) {
  return {
    ok: false,
    error: {
      code,
      type: KNOWN_ERROR_TYPES.has(type) ? type : "unknown",
      message,
      action
    },
    request_id: requestId
  };
}

function appError(code, type, message, action) {
  const error = new Error(message);
  error.code = code;
  error.type = type;
  error.action = action;
  return error;
}

function normalizeError(error, requestId) {
  if (error && error.code && error.type && error.action) {
    return errorResponse({
      code: error.code,
      type: error.type,
      message: error.message,
      action: error.action,
      requestId
    });
  }

  return errorResponse({
    code: "UNKNOWN_ERROR",
    type: "unknown",
    message: "服务暂时不可用，请稍后重试",
    action: "contact_support",
    requestId
  });
}

module.exports = {
  createRequestId,
  okResponse,
  errorResponse,
  appError,
  normalizeError
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/cloudfunctions/shared-response.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add cloudfunctions/_shared/response.js tests/cloudfunctions/shared-response.test.js
git commit -m "feat: add typed cloud function responses"
```

---

### Task 3: Prompt Templates and Validators

**Files:**
- Create: `cloudfunctions/_shared/prompts/incubation.js`
- Create: `cloudfunctions/_shared/validators/incubation.js`
- Create: `tests/cloudfunctions/incubation-prompts.test.js`
- Create: `tests/cloudfunctions/incubation-validators.test.js`

- [ ] **Step 1: Write failing prompt tests**

Create `tests/cloudfunctions/incubation-prompts.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  renderQuestionPrompt,
  renderResearchPrompt
} = require("../../cloudfunctions/_shared/prompts/incubation");

test("renders question prompt with idea and JSON contract", () => {
  const prompt = renderQuestionPrompt("我想做 AI PRD 工具");

  assert.match(prompt, /AI PRD 工具/);
  assert.match(prompt, /只输出 JSON/);
  assert.match(prompt, /initialAssessment/);
  assert.match(prompt, /questions/);
});

test("renders research prompt with answers JSON and sources contract", () => {
  const prompt = renderResearchPrompt({
    idea: "我想做 AI PRD 工具",
    answers: [{ questionId: "q1", selectedOptions: ["developer"] }]
  });

  assert.match(prompt, /联网搜索/);
  assert.match(prompt, /AI PRD 工具/);
  assert.match(prompt, /"questionId": "q1"/);
  assert.match(prompt, /researchSources/);
});
```

- [ ] **Step 2: Write failing validator tests**

Create `tests/cloudfunctions/incubation-validators.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  validateIdea,
  normalizeQuestionPayload,
  normalizeAnalysisPayload,
  normalizeGeneratedProjectDraft
} = require("../../cloudfunctions/_shared/validators/incubation");

test("rejects empty ideas", () => {
  assert.throws(() => validateIdea("  "), /项目灵感不能为空/);
});

test("normalizes question payload", () => {
  const payload = normalizeQuestionPayload({
    initialAssessment: { summary: "做 AI PRD", missingInfo: ["用户"], readyForResearch: false },
    questions: [
      {
        questionId: "q_target_user",
        title: "目标用户是谁？",
        description: "选择最想服务的人群",
        type: "single",
        options: [{ label: "独立开发者", value: "indie_dev" }],
        allowCustomInput: true,
        isRequired: true
      }
    ]
  });

  assert.equal(payload.questions[0].questionId, "q_target_user");
  assert.equal(payload.questions[0].options[0].value, "indie_dev");
});

test("normalizes analysis payload with risks and sources", () => {
  const payload = normalizeAnalysisPayload({
    title: "AI PRD 生成器",
    conclusion: "建议收窄到独立开发者",
    limitedInfo: false,
    limitedInfoReason: "",
    domesticProducts: [],
    globalProducts: [],
    entryDirection: "先做小程序 PRD 模板",
    advantages: ["开发成本低"],
    risks: [{ description: "竞品多", source: "竞品强度" }],
    suggestions: [{ priority: "P0", action: "访谈 5 个用户", expectedSignal: "3 人愿意试用" }],
    researchSources: [{ title: "来源", url: "https://example.com", summary: "竞品信息" }]
  });

  assert.equal(payload.risks[0].source, "竞品强度");
  assert.equal(payload.suggestions[0].priority, "P0");
});

test("normalizes generated project draft for saving", () => {
  const project = normalizeGeneratedProjectDraft({
    sourceIdea: "我想做 AI PRD 工具",
    answers: [],
    title: "AI PRD 生成器",
    conclusion: "建议做",
    limitedInfo: false,
    limitedInfoReason: "",
    domesticProducts: [],
    globalProducts: [],
    entryDirection: "独立开发者 PRD",
    advantages: ["熟悉开发者"],
    risks: [{ description: "获客难", source: "获客难度" }],
    suggestions: [{ priority: "P0", action: "发帖验证", expectedSignal: "10 个回复" }],
    researchSources: [],
    modelInfo: { reasoningProvider: "deepseek", reasoningModel: "deepseek-v4-pro", researchProvider: "doubao", researchModel: "doubao-test" }
  });

  assert.equal(project.sourceIdea, "我想做 AI PRD 工具");
  assert.equal(project.favoriteStatus, false);
  assert.equal(project.compareStatus, false);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
node --test tests/cloudfunctions/incubation-prompts.test.js tests/cloudfunctions/incubation-validators.test.js
```

Expected: FAIL because prompt and validator modules do not exist.

- [ ] **Step 4: Implement prompt templates**

Create `cloudfunctions/_shared/prompts/incubation.js`:

```js
function renderQuestionPrompt(idea) {
  return `你是一个面向独立开发者的项目方向孵化顾问。你的任务是根据用户输入的项目灵感，判断为了做后续市场调研和方向分析，还缺少哪些关键信息，并生成适合移动端回答的追问问题。

要求：
1. 只输出 JSON，不要输出 Markdown、解释文本或代码块。
2. 问题数量控制在 4-6 个；如果用户灵感已经非常完整，可以少于 4 个。
3. 问题必须帮助判断：目标用户、核心痛点、使用场景、用户资源、技术/运营能力、变现偏好、风险边界、期望结果。
4. 每个问题必须适合手机端选择，标题简短，说明不超过 40 个中文字符。
5. 选项应具体、互斥或可组合，不要使用空泛选项。
6. 如果问题允许自由补充，设置 allowCustomInput=true。
7. 不要生成最终项目结论、竞品分析或市场判断。
8. 如果用户输入过短或含糊，也要给出可以帮助澄清方向的问题。

用户灵感：
${idea}

请严格按以下 JSON 结构输出：

{
  "initialAssessment": {
    "summary": "用一句话复述你理解的项目灵感",
    "missingInfo": ["缺少的信息点"],
    "readyForResearch": false
  },
  "questions": [
    {
      "questionId": "q_target_user",
      "title": "问题标题",
      "description": "问题说明",
      "type": "single | multiple",
      "options": [
        { "label": "选项文案", "value": "stable_value" }
      ],
      "allowCustomInput": true,
      "isRequired": true
    }
  ]
}`;
}

function renderResearchPrompt({ idea, answers }) {
  return `你是一个严谨的独立开发项目市场研究员。你的任务是基于用户的项目灵感和追问答案，结合联网搜索结果，分析国内外相似产品，给出适合独立开发者切入的项目方向建议。

要求：
1. 只输出 JSON，不要输出 Markdown、解释文本或代码块。
2. 必须优先使用联网搜索获得的信息；不能确认的信息要标记为信息有限，不要编造事实。
3. 国内产品和国外产品各返回 3 个。如果搜索证据不足，可以少于 3 个，但必须说明 limitedInfoReason。
4. 每个产品必须包含定位、主要优势、主要短板。
5. 风险必须包含风险描述和风险来源。风险来源可以是竞品强度、平台政策、获客难度、数据来源不稳定、合规要求、付费意愿不足、技术门槛等。
6. 推荐切入方向必须结合用户资源、追问答案和竞品差异，不要给泛泛建议。
7. 建议必须是最小验证动作，按优先级排列。
8. 如果搜索结果不足以支撑强结论，conclusion 中必须明确“信息有限，需要进一步验证”。
9. researchSources 只放实际用于判断的信息来源摘要，不要放无关搜索结果。

用户灵感：
${idea}

用户追问答案：
${JSON.stringify(answers, null, 2)}

请严格按以下 JSON 结构输出：

{
  "title": "项目方向标题",
  "conclusion": "方向结论，说明建议做/需要收窄/暂不建议直接做，以及原因",
  "limitedInfo": false,
  "limitedInfoReason": "",
  "domesticProducts": [],
  "globalProducts": [],
  "entryDirection": "推荐切入方向",
  "advantages": ["用户可切入优势"],
  "risks": [
    { "description": "风险描述", "source": "风险来源" }
  ],
  "suggestions": [
    { "priority": "P0 | P1 | P2", "action": "下一步最小验证动作", "expectedSignal": "用什么信号判断是否继续" }
  ],
  "researchSources": [
    { "title": "来源标题", "url": "来源 URL，如无 URL 则为空字符串", "summary": "该来源支持了什么判断" }
  ]
}`;
}

module.exports = {
  renderQuestionPrompt,
  renderResearchPrompt
};
```

- [ ] **Step 5: Implement validators**

Create `cloudfunctions/_shared/validators/incubation.js`:

```js
const { appError } = require("../response");

function ensureString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw appError("VALIDATION_ERROR", "validation", `${fieldName}不能为空`, "edit_input");
  }

  return value.trim();
}

function ensureArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw appError("VALIDATION_ERROR", "validation", `${fieldName}必须是数组`, "edit_input");
  }

  return value;
}

function validateIdea(idea) {
  return ensureString(idea, "项目灵感");
}

function normalizeOptions(options) {
  return ensureArray(options, "选项").map((option) => ({
    label: ensureString(option && option.label, "选项文案"),
    value: ensureString(option && option.value, "选项值")
  }));
}

function normalizeQuestionPayload(payload) {
  const assessment = payload && payload.initialAssessment ? payload.initialAssessment : {};
  const questions = ensureArray(payload && payload.questions, "追问问题").map((question) => ({
    questionId: ensureString(question.questionId, "问题 ID"),
    title: ensureString(question.title, "问题标题"),
    description: typeof question.description === "string" ? question.description.trim() : "",
    type: question.type === "multiple" ? "multiple" : "single",
    options: normalizeOptions(question.options),
    allowCustomInput: Boolean(question.allowCustomInput),
    isRequired: question.isRequired !== false
  }));

  if (!questions.length) {
    throw appError("AI_OUTPUT_INVALID", "ai_output", "模型没有返回可用追问", "retry");
  }

  return {
    initialAssessment: {
      summary: typeof assessment.summary === "string" ? assessment.summary.trim() : "",
      missingInfo: Array.isArray(assessment.missingInfo) ? assessment.missingInfo.map(String) : [],
      readyForResearch: Boolean(assessment.readyForResearch)
    },
    questions
  };
}

function normalizeProduct(product) {
  return {
    name: ensureString(product && product.name, "产品名称"),
    positioning: ensureString(product && product.positioning, "产品定位"),
    strengths: ensureString(product && product.strengths, "主要优势"),
    weaknesses: ensureString(product && product.weaknesses, "主要短板"),
    evidence: typeof product.evidence === "string" ? product.evidence.trim() : ""
  };
}

function normalizeSuggestion(suggestion) {
  const priority = ["P0", "P1", "P2"].includes(suggestion && suggestion.priority) ? suggestion.priority : "P1";

  return {
    priority,
    action: ensureString(suggestion && suggestion.action, "建议动作"),
    expectedSignal: ensureString(suggestion && suggestion.expectedSignal, "验证信号")
  };
}

function normalizeAnalysisPayload(payload) {
  const risks = ensureArray(payload && payload.risks, "风险").map((risk) => ({
    description: ensureString(risk && risk.description, "风险描述"),
    source: ensureString(risk && risk.source, "风险来源")
  }));

  if (!risks.length) {
    throw appError("AI_OUTPUT_INVALID", "ai_output", "模型没有返回风险来源", "retry");
  }

  return {
    title: ensureString(payload && payload.title, "项目标题"),
    conclusion: ensureString(payload && payload.conclusion, "方向结论"),
    limitedInfo: Boolean(payload && payload.limitedInfo),
    limitedInfoReason: typeof (payload && payload.limitedInfoReason) === "string" ? payload.limitedInfoReason.trim() : "",
    domesticProducts: ensureArray(payload && payload.domesticProducts, "国内产品").map(normalizeProduct),
    globalProducts: ensureArray(payload && payload.globalProducts, "国外产品").map(normalizeProduct),
    entryDirection: ensureString(payload && payload.entryDirection, "切入方向"),
    advantages: ensureArray(payload && payload.advantages, "切入优势").map(String),
    risks,
    suggestions: ensureArray(payload && payload.suggestions, "建议").map(normalizeSuggestion),
    researchSources: ensureArray(payload && payload.researchSources, "调研来源").map((source) => ({
      title: ensureString(source && source.title, "来源标题"),
      url: typeof source.url === "string" ? source.url.trim() : "",
      summary: ensureString(source && source.summary, "来源摘要")
    }))
  };
}

function normalizeAnswers(answers) {
  return ensureArray(answers, "追问答案").map((answer) => ({
    questionId: ensureString(answer && answer.questionId, "问题 ID"),
    questionTitle: typeof answer.questionTitle === "string" ? answer.questionTitle.trim() : "",
    selectedOptions: Array.isArray(answer && answer.selectedOptions) ? answer.selectedOptions.map(String) : [],
    customInput: typeof (answer && answer.customInput) === "string" ? answer.customInput.trim() : ""
  }));
}

function normalizeGeneratedProjectDraft(project) {
  const normalized = normalizeAnalysisPayload(project);

  return {
    sourceIdea: validateIdea(project && project.sourceIdea),
    answers: normalizeAnswers(project && project.answers),
    ...normalized,
    modelInfo: {
      reasoningProvider: ensureString(project && project.modelInfo && project.modelInfo.reasoningProvider, "推理模型供应商"),
      reasoningModel: ensureString(project && project.modelInfo && project.modelInfo.reasoningModel, "推理模型"),
      researchProvider: ensureString(project && project.modelInfo && project.modelInfo.researchProvider, "调研模型供应商"),
      researchModel: ensureString(project && project.modelInfo && project.modelInfo.researchModel, "调研模型")
    },
    favoriteStatus: Boolean(project && project.favoriteStatus),
    compareStatus: Boolean(project && project.compareStatus)
  };
}

module.exports = {
  validateIdea,
  normalizeAnswers,
  normalizeQuestionPayload,
  normalizeAnalysisPayload,
  normalizeGeneratedProjectDraft
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
node --test tests/cloudfunctions/incubation-prompts.test.js tests/cloudfunctions/incubation-validators.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add cloudfunctions/_shared/prompts/incubation.js cloudfunctions/_shared/validators/incubation.js tests/cloudfunctions/incubation-prompts.test.js tests/cloudfunctions/incubation-validators.test.js
git commit -m "feat: add incubation prompts and validators"
```

---

### Task 4: AI Gateway With Provider Routing

**Files:**
- Create: `cloudfunctions/_shared/env.js`
- Create: `cloudfunctions/_shared/ai-gateway/index.js`
- Create: `cloudfunctions/_shared/ai-gateway/providers/deepseek.js`
- Create: `cloudfunctions/_shared/ai-gateway/providers/doubao.js`
- Create: `tests/cloudfunctions/ai-gateway.test.js`

- [ ] **Step 1: Write failing AI gateway tests**

Create `tests/cloudfunctions/ai-gateway.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { createAiGateway } = require("../../cloudfunctions/_shared/ai-gateway");

test("routes reasoning tasks to DeepSeek defaults", async () => {
  const calls = [];
  const gateway = createAiGateway({
    env: {
      AI_REASONING_PROVIDER: "deepseek",
      AI_REASONING_MODEL: "deepseek-v4-pro",
      DEEPSEEK_API_KEY: "key",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com"
    },
    providers: {
      deepseek: async (request) => {
        calls.push(request);
        return { text: "{\"ok\":true}", provider: request.provider, model: request.model };
      }
    }
  });

  const result = await gateway.callModel({ taskType: "reasoning", messages: [{ role: "user", content: "hi" }] });

  assert.equal(result.provider, "deepseek");
  assert.equal(result.model, "deepseek-v4-pro");
  assert.equal(calls[0].model, "deepseek-v4-pro");
});

test("routes web research tasks to Doubao defaults", async () => {
  const gateway = createAiGateway({
    env: {
      AI_WEB_RESEARCH_PROVIDER: "doubao",
      AI_WEB_RESEARCH_MODEL: "doubao-web",
      ARK_API_KEY: "key",
      ARK_BASE_URL: "https://ark.cn-beijing.volces.com/api/v3"
    },
    providers: {
      doubao: async (request) => ({ text: "{\"ok\":true}", provider: request.provider, model: request.model, tools: request.tools })
    }
  });

  const result = await gateway.callModel({ taskType: "web_research", messages: [{ role: "user", content: "search" }] });

  assert.equal(result.provider, "doubao");
  assert.equal(result.model, "doubao-web");
  assert.deepEqual(result.tools, [{ type: "web_search" }]);
});

test("returns typed configuration error when model is missing", async () => {
  const gateway = createAiGateway({
    env: { AI_WEB_RESEARCH_PROVIDER: "doubao", ARK_API_KEY: "key" },
    providers: {}
  });

  await assert.rejects(
    () => gateway.callModel({ taskType: "web_research", messages: [] }),
    (error) => {
      assert.equal(error.code, "MODEL_NOT_CONFIGURED");
      assert.equal(error.type, "configuration");
      return true;
    }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/cloudfunctions/ai-gateway.test.js
```

Expected: FAIL because AI gateway modules do not exist.

- [ ] **Step 3: Implement env helper**

Create `cloudfunctions/_shared/env.js`:

```js
function getEnv(name, env) {
  return (env || process.env || {})[name] || "";
}

function resolveTaskConfig(taskType, env) {
  const source = env || process.env || {};

  if (taskType === "web_research") {
    return {
      provider: getEnv("AI_WEB_RESEARCH_PROVIDER", source) || getEnv("AI_PROVIDER", source) || "doubao",
      model: getEnv("AI_WEB_RESEARCH_MODEL", source) || "",
      apiKey: getEnv("ARK_API_KEY", source),
      baseUrl: getEnv("ARK_BASE_URL", source) || "https://ark.cn-beijing.volces.com/api/v3"
    };
  }

  return {
    provider: getEnv("AI_REASONING_PROVIDER", source) || getEnv("AI_PROVIDER", source) || "deepseek",
    model: getEnv("AI_REASONING_MODEL", source) || getEnv("AI_MODEL", source) || "deepseek-v4-pro",
    apiKey: getEnv("DEEPSEEK_API_KEY", source) || getEnv("OPENAI_API_KEY", source),
    baseUrl: getEnv("DEEPSEEK_BASE_URL", source) || "https://api.deepseek.com"
  };
}

module.exports = {
  resolveTaskConfig
};
```

- [ ] **Step 4: Implement AI gateway**

Create `cloudfunctions/_shared/ai-gateway/index.js`:

```js
const { appError } = require("../response");
const { resolveTaskConfig } = require("../env");
const { callDeepSeek } = require("./providers/deepseek");
const { callDoubao } = require("./providers/doubao");

function createAiGateway({ env, providers } = {}) {
  const providerMap = {
    deepseek: callDeepSeek,
    doubao: callDoubao,
    ...(providers || {})
  };

  async function callModel({ taskType, provider, model, messages, responseFormat, tools, temperature, requestId }) {
    const defaults = resolveTaskConfig(taskType, env);
    const resolvedProvider = provider || defaults.provider;
    const resolvedModel = model || defaults.model;

    if (!resolvedProvider || !providerMap[resolvedProvider]) {
      throw appError("MODEL_NOT_CONFIGURED", "configuration", "模型供应商未配置", "configure_model");
    }

    if (!resolvedModel) {
      throw appError("MODEL_NOT_CONFIGURED", "configuration", "模型名称未配置", "configure_model");
    }

    if (!defaults.apiKey && !provider) {
      throw appError("MODEL_NOT_CONFIGURED", "configuration", "模型 Key 未配置", "configure_model");
    }

    const resolvedTools = tools || (taskType === "web_research" ? [{ type: "web_search" }] : undefined);

    return providerMap[resolvedProvider]({
      taskType,
      provider: resolvedProvider,
      model: resolvedModel,
      apiKey: defaults.apiKey,
      baseUrl: defaults.baseUrl,
      messages,
      responseFormat,
      tools: resolvedTools,
      temperature,
      requestId
    });
  }

  return {
    callModel
  };
}

module.exports = {
  createAiGateway
};
```

- [ ] **Step 5: Implement provider clients**

Create `cloudfunctions/_shared/ai-gateway/providers/deepseek.js`:

```js
const axios = require("axios");
const { appError } = require("../../response");

async function callDeepSeek(request) {
  try {
    const response = await axios.post(
      `${request.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        response_format: request.responseFormat || { type: "json_object" }
      },
      {
        headers: {
          Authorization: `Bearer ${request.apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 90000
      }
    );

    return {
      provider: "deepseek",
      model: request.model,
      text: response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content
    };
  } catch (error) {
    if (error && error.response && [401, 403].includes(error.response.status)) {
      throw appError("MODEL_AUTH_FAILED", "authentication", "DeepSeek Key 无效或无权限", "configure_model");
    }

    throw appError("AI_GENERATION_FAILED", "ai_generation", "DeepSeek 生成失败，请重试", "retry");
  }
}

module.exports = {
  callDeepSeek
};
```

Create `cloudfunctions/_shared/ai-gateway/providers/doubao.js`:

```js
const axios = require("axios");
const { appError } = require("../../response");

async function callDoubao(request) {
  try {
    const response = await axios.post(
      `${request.baseUrl.replace(/\/$/, "")}/responses`,
      {
        model: request.model,
        input: request.messages.map((message) => ({
          role: message.role,
          content: message.content
        })),
        tools: request.tools || [{ type: "web_search" }]
      },
      {
        headers: {
          Authorization: `Bearer ${request.apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 120000
      }
    );

    const output = response.data && response.data.output;
    const text = Array.isArray(output)
      ? output.flatMap((item) => item.content || []).map((part) => part.text || "").join("")
      : response.data && response.data.output_text;

    return {
      provider: "doubao",
      model: request.model,
      text,
      tools: request.tools || [{ type: "web_search" }]
    };
  } catch (error) {
    if (error && error.response && [401, 403].includes(error.response.status)) {
      throw appError("MODEL_AUTH_FAILED", "authentication", "豆包/火山方舟 Key 无效或无权限", "configure_model");
    }

    throw appError("AI_GENERATION_FAILED", "ai_generation", "联网调研生成失败，请重试", "retry");
  }
}

module.exports = {
  callDoubao
};
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
node --test tests/cloudfunctions/ai-gateway.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add cloudfunctions/_shared/env.js cloudfunctions/_shared/ai-gateway tests/cloudfunctions/ai-gateway.test.js
git commit -m "feat: add AI gateway provider routing"
```

---

### Task 5: Generated Project Persistence Helpers

**Files:**
- Create: `cloudfunctions/_shared/generated-projects.js`
- Create: `tests/cloudfunctions/generated-projects.test.js`

- [ ] **Step 1: Write failing persistence tests**

Create `tests/cloudfunctions/generated-projects.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  mapProjectToDocument,
  mapDocumentToProject,
  createGeneratedProjectRepository
} = require("../../cloudfunctions/_shared/generated-projects");

const draft = {
  sourceIdea: "做 AI PRD",
  answers: [],
  title: "AI PRD 生成器",
  conclusion: "建议做",
  limitedInfo: false,
  limitedInfoReason: "",
  domesticProducts: [],
  globalProducts: [],
  entryDirection: "开发者 PRD",
  advantages: ["熟悉用户"],
  risks: [{ description: "竞品多", source: "竞品强度" }],
  suggestions: [{ priority: "P0", action: "访谈", expectedSignal: "愿意试用" }],
  researchSources: [],
  modelInfo: { reasoningProvider: "deepseek", reasoningModel: "deepseek-v4-pro", researchProvider: "doubao", researchModel: "doubao-web" },
  favoriteStatus: false,
  compareStatus: false
};

test("maps frontend project draft to database document", () => {
  const doc = mapProjectToDocument({
    project: draft,
    assetId: "asset_1",
    openid: "openid_1",
    userId: "user_1",
    now: "2026-06-01T00:00:00.000Z"
  });

  assert.equal(doc.asset_id, "asset_1");
  assert.equal(doc.owner_openid, "openid_1");
  assert.equal(doc.source_idea, "做 AI PRD");
  assert.equal(doc.model_info.research_provider, "doubao");
});

test("maps database document to frontend project", () => {
  const project = mapDocumentToProject({
    asset_id: "asset_1",
    source_idea: "做 AI PRD",
    answers: [],
    title: "AI PRD 生成器",
    conclusion: "建议做",
    limited_info: false,
    limited_info_reason: "",
    domestic_products: [],
    global_products: [],
    entry_direction: "开发者 PRD",
    advantages: [],
    risks: [],
    suggestions: [],
    research_sources: [],
    model_info: { reasoning_provider: "deepseek", reasoning_model: "deepseek-v4-pro", research_provider: "doubao", research_model: "doubao-web" },
    favorite_status: false,
    compare_status: false,
    created_at: "2026-06-01T00:00:00.000Z"
  });

  assert.equal(project.id, "asset_1");
  assert.equal(project.sourceIdea, "做 AI PRD");
  assert.equal(project.modelInfo.researchProvider, "doubao");
});

test("repository lists only current user documents", async () => {
  const writes = [];
  const docs = [
    { asset_id: "asset_1", owner_openid: "openid_1", status: "active", asset_type: "incubated_project", created_at: "2026-06-01T01:00:00.000Z", title: "A", source_idea: "A", answers: [], conclusion: "A", limited_info: false, limited_info_reason: "", domestic_products: [], global_products: [], entry_direction: "A", advantages: [], risks: [], suggestions: [], research_sources: [], model_info: {}, favorite_status: false, compare_status: false },
    { asset_id: "asset_2", owner_openid: "openid_2", status: "active", asset_type: "incubated_project", created_at: "2026-06-01T02:00:00.000Z", title: "B", source_idea: "B", answers: [], conclusion: "B", limited_info: false, limited_info_reason: "", domestic_products: [], global_products: [], entry_direction: "B", advantages: [], risks: [], suggestions: [], research_sources: [], model_info: {}, favorite_status: false, compare_status: false }
  ];
  const db = {
    collection() {
      return {
        where(query) {
          return {
            async get() {
              return { data: docs.filter((doc) => Object.entries(query).every(([key, value]) => doc[key] === value)) };
            }
          };
        },
        async add({ data }) {
          writes.push(data);
          return { _id: "doc_1" };
        }
      };
    }
  };

  const repo = createGeneratedProjectRepository({ db, now: () => "2026-06-01T03:00:00.000Z", createId: () => "asset_3" });
  const list = await repo.listProjects({ openid: "openid_1", page: 1, pageSize: 10 });

  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].id, "asset_1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/cloudfunctions/generated-projects.test.js
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement persistence helpers**

Create `cloudfunctions/_shared/generated-projects.js`:

```js
const { appError } = require("./response");
const { normalizeGeneratedProjectDraft } = require("./validators/incubation");

function mapProjectToDocument({ project, assetId, openid, userId, now }) {
  const normalized = normalizeGeneratedProjectDraft(project);

  return {
    asset_id: assetId,
    asset_type: "incubated_project",
    owner_openid: openid,
    owner_user_id: userId || "",
    source_idea: normalized.sourceIdea,
    answers: normalized.answers,
    title: normalized.title,
    conclusion: normalized.conclusion,
    limited_info: normalized.limitedInfo,
    limited_info_reason: normalized.limitedInfoReason,
    domestic_products: normalized.domesticProducts,
    global_products: normalized.globalProducts,
    entry_direction: normalized.entryDirection,
    advantages: normalized.advantages,
    risks: normalized.risks,
    suggestions: normalized.suggestions,
    research_sources: normalized.researchSources,
    model_info: {
      reasoning_provider: normalized.modelInfo.reasoningProvider,
      reasoning_model: normalized.modelInfo.reasoningModel,
      research_provider: normalized.modelInfo.researchProvider,
      research_model: normalized.modelInfo.researchModel
    },
    favorite_status: normalized.favoriteStatus,
    compare_status: normalized.compareStatus,
    status: "active",
    created_at: now,
    updated_at: now
  };
}

function mapDocumentToProject(doc) {
  return {
    id: doc.asset_id,
    sourceIdea: doc.source_idea,
    answers: doc.answers || [],
    title: doc.title,
    conclusion: doc.conclusion,
    limitedInfo: Boolean(doc.limited_info),
    limitedInfoReason: doc.limited_info_reason || "",
    domesticProducts: doc.domestic_products || [],
    globalProducts: doc.global_products || [],
    entryDirection: doc.entry_direction,
    advantages: doc.advantages || [],
    risks: doc.risks || [],
    suggestions: doc.suggestions || [],
    researchSources: doc.research_sources || [],
    modelInfo: {
      reasoningProvider: doc.model_info && doc.model_info.reasoning_provider || "",
      reasoningModel: doc.model_info && doc.model_info.reasoning_model || "",
      researchProvider: doc.model_info && doc.model_info.research_provider || "",
      researchModel: doc.model_info && doc.model_info.research_model || ""
    },
    favoriteStatus: Boolean(doc.favorite_status),
    compareStatus: Boolean(doc.compare_status),
    createdAt: doc.created_at
  };
}

function createGeneratedProjectRepository({ db, now, createId }) {
  const assets = db.collection("generated_assets");

  async function saveProject({ openid, userId, project }) {
    if (!openid) {
      throw appError("UNAUTHENTICATED", "authentication", "未获取到用户身份", "login");
    }

    const timestamp = now();
    const doc = mapProjectToDocument({
      project,
      assetId: createId(),
      openid,
      userId,
      now: timestamp
    });

    try {
      await assets.add({ data: doc });
      return mapDocumentToProject(doc);
    } catch (error) {
      throw appError("DATABASE_WRITE_FAILED", "database", "保存项目失败，请重试", "retry");
    }
  }

  async function listProjects({ openid, assetId, page, pageSize }) {
    if (!openid) {
      throw appError("UNAUTHENTICATED", "authentication", "未获取到用户身份", "login");
    }

    const query = {
      owner_openid: openid,
      asset_type: "incubated_project",
      status: "active"
    };

    if (assetId) {
      query.asset_id = assetId;
    }

    const result = await assets.where(query).get();
    const sorted = result.data
      .slice()
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    const safePage = Math.max(Number(page) || 1, 1);
    const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 50);
    const offset = (safePage - 1) * safePageSize;
    const paged = sorted.slice(offset, offset + safePageSize);

    if (assetId && !paged.length) {
      throw appError("NOT_FOUND", "permission", "项目不存在或无权访问", "retry");
    }

    return {
      items: paged.map(mapDocumentToProject),
      page: safePage,
      pageSize: safePageSize,
      total: sorted.length
    };
  }

  return {
    saveProject,
    listProjects
  };
}

module.exports = {
  mapProjectToDocument,
  mapDocumentToProject,
  createGeneratedProjectRepository
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/cloudfunctions/generated-projects.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add cloudfunctions/_shared/generated-projects.js tests/cloudfunctions/generated-projects.test.js
git commit -m "feat: add generated project persistence helpers"
```

---

### Task 6: Cloud Function Shared Sync Script

**Files:**
- Create: `scripts/sync-cloud-shared.js`
- Modify: `package.json`

- [ ] **Step 1: Create sync script**

Create `scripts/sync-cloud-shared.js`:

```js
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "cloudfunctions", "_shared");
const targets = [
  "createIncubationQuestions",
  "generateIncubationAnalysis",
  "saveGeneratedProject",
  "listGeneratedProjects"
];

function copyDirectory(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

for (const target of targets) {
  const targetDir = path.join(root, "cloudfunctions", target);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  copyDirectory(source, path.join(targetDir, "_shared"));
}

console.log(`Synced cloudfunctions/_shared to ${targets.length} functions.`);
```

- [ ] **Step 2: Add sync script to `package.json`**

Modify root `package.json` scripts:

```json
{
  "scripts": {
    "cloudbase:version": "bunx @cloudbase/cli --version",
    "mcp:status": "bunx mcporter call cloudbase.auth action=status --output json",
    "mcp:envs": "bunx mcporter call cloudbase.envQuery action=list --output json",
    "mcp:describe": "bunx mcporter describe cloudbase --all-parameters",
    "cloudfunctions:sync-shared": "node scripts/sync-cloud-shared.js"
  }
}
```

- [ ] **Step 3: Run sync script**

Run:

```bash
pnpm run cloudfunctions:sync-shared
```

Expected: prints `Synced cloudfunctions/_shared to 4 functions.` and creates `_shared` folders under the four target function directories.

- [ ] **Step 4: Commit**

Run:

```bash
git add scripts/sync-cloud-shared.js package.json cloudfunctions/createIncubationQuestions/_shared cloudfunctions/generateIncubationAnalysis/_shared cloudfunctions/saveGeneratedProject/_shared cloudfunctions/listGeneratedProjects/_shared
git commit -m "chore: sync shared cloud function modules"
```

---

### Task 7: `createIncubationQuestions` Cloud Function

**Files:**
- Create: `cloudfunctions/createIncubationQuestions/package.json`
- Create: `cloudfunctions/createIncubationQuestions/tsconfig.json`
- Create: `cloudfunctions/createIncubationQuestions/index.js`
- Create: `cloudfunctions/createIncubationQuestions/handler.js`
- Create: `tests/cloudfunctions/createIncubationQuestions.test.js`

- [ ] **Step 1: Write failing handler tests**

Create `tests/cloudfunctions/createIncubationQuestions.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { createCreateIncubationQuestions } = require("../../cloudfunctions/createIncubationQuestions/handler");

test("returns validation error for empty idea", async () => {
  const main = createCreateIncubationQuestions({
    gateway: { callModel: async () => { throw new Error("should not call model"); } },
    now: () => "2026-06-01T00:00:00.000Z",
    createId: () => "session_1"
  });

  const result = await main({ idea: " " }, {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(result.error.type, "validation");
});

test("returns generated question payload", async () => {
  const main = createCreateIncubationQuestions({
    gateway: {
      async callModel() {
        return {
          provider: "deepseek",
          model: "deepseek-v4-pro",
          text: JSON.stringify({
            initialAssessment: { summary: "做 AI PRD", missingInfo: ["用户"], readyForResearch: false },
            questions: [
              {
                questionId: "q_target_user",
                title: "目标用户是谁？",
                description: "选择最想服务的人群",
                type: "single",
                options: [{ label: "独立开发者", value: "indie_dev" }],
                allowCustomInput: true,
                isRequired: true
              }
            ]
          })
        };
      }
    },
    now: () => "2026-06-01T00:00:00.000Z",
    createId: () => "session_1"
  });

  const result = await main({ idea: "我想做 AI PRD 工具" }, {});

  assert.equal(result.ok, true);
  assert.equal(result.data.session_id, "session_1");
  assert.equal(result.data.questions[0].questionId, "q_target_user");
  assert.equal(result.data.modelInfo.reasoningProvider, "deepseek");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/cloudfunctions/createIncubationQuestions.test.js
```

Expected: FAIL because handler does not exist.

- [ ] **Step 3: Implement handler and index**

Create `cloudfunctions/createIncubationQuestions/handler.js`:

```js
const { createRequestId, okResponse, normalizeError, appError } = require("./_shared/response");
const { renderQuestionPrompt } = require("./_shared/prompts/incubation");
const { validateIdea, normalizeQuestionPayload } = require("./_shared/validators/incubation");

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw appError("AI_OUTPUT_INVALID", "ai_output", "追问结果不是有效 JSON", "retry");
  }
}

function createCreateIncubationQuestions({ gateway, now, createId }) {
  return async (event) => {
    const requestId = createRequestId(now);

    try {
      const idea = validateIdea(event && event.idea);
      const prompt = renderQuestionPrompt(idea);
      const modelResult = await gateway.callModel({
        taskType: "reasoning",
        provider: event && event.provider,
        model: event && event.model,
        messages: [{ role: "user", content: prompt }],
        responseFormat: { type: "json_object" },
        temperature: 0.2,
        requestId
      });
      const payload = normalizeQuestionPayload(parseJson(modelResult.text));

      return okResponse({
        session_id: createId(),
        initialAssessment: payload.initialAssessment,
        questions: payload.questions,
        modelInfo: {
          reasoningProvider: modelResult.provider,
          reasoningModel: modelResult.model
        }
      }, requestId);
    } catch (error) {
      return normalizeError(error, requestId);
    }
  };
}

module.exports = {
  createCreateIncubationQuestions
};
```

Create `cloudfunctions/createIncubationQuestions/index.js`:

```js
const cloud = require("wx-server-sdk");
const { createAiGateway } = require("./_shared/ai-gateway");
const { createCreateIncubationQuestions } = require("./handler");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

function createId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

exports.main = createCreateIncubationQuestions({
  gateway: createAiGateway(),
  now: () => new Date().toISOString(),
  createId
});
```

Create `cloudfunctions/createIncubationQuestions/package.json` by copying `cloudfunctions/getUserContext/package.json` and changing `"name"` to `"create-incubation-questions"`.

Create `cloudfunctions/createIncubationQuestions/tsconfig.json` by copying `cloudfunctions/getUserContext/tsconfig.json`.

- [ ] **Step 4: Sync shared modules and run test**

Run:

```bash
pnpm run cloudfunctions:sync-shared
node --test tests/cloudfunctions/createIncubationQuestions.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add cloudfunctions/createIncubationQuestions tests/cloudfunctions/createIncubationQuestions.test.js
git commit -m "feat: add incubation question cloud function"
```

---

### Task 8: `generateIncubationAnalysis` Cloud Function

**Files:**
- Create: `cloudfunctions/generateIncubationAnalysis/package.json`
- Create: `cloudfunctions/generateIncubationAnalysis/tsconfig.json`
- Create: `cloudfunctions/generateIncubationAnalysis/index.js`
- Create: `cloudfunctions/generateIncubationAnalysis/handler.js`
- Create: `tests/cloudfunctions/generateIncubationAnalysis.test.js`

- [ ] **Step 1: Write failing handler tests**

Create `tests/cloudfunctions/generateIncubationAnalysis.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { createGenerateIncubationAnalysis } = require("../../cloudfunctions/generateIncubationAnalysis/handler");

test("returns validation error for invalid answers", async () => {
  const main = createGenerateIncubationAnalysis({
    gateway: { callModel: async () => { throw new Error("should not call model"); } },
    now: () => "2026-06-01T00:00:00.000Z"
  });

  const result = await main({ idea: "AI PRD", answers: "bad" }, {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
});

test("returns structured analysis draft with model info", async () => {
  const main = createGenerateIncubationAnalysis({
    gateway: {
      async callModel() {
        return {
          provider: "doubao",
          model: "doubao-web",
          text: JSON.stringify({
            title: "AI PRD 生成器",
            conclusion: "建议收窄到独立开发者 PRD",
            limitedInfo: false,
            limitedInfoReason: "",
            domesticProducts: [],
            globalProducts: [],
            entryDirection: "先做微信小程序 PRD 模板",
            advantages: ["熟悉开发者工作流"],
            risks: [{ description: "竞品较多", source: "竞品强度" }],
            suggestions: [{ priority: "P0", action: "访谈 5 个开发者", expectedSignal: "3 人愿意试用" }],
            researchSources: [{ title: "搜索来源", url: "https://example.com", summary: "竞品信息" }]
          })
        };
      }
    },
    now: () => "2026-06-01T00:00:00.000Z"
  });

  const result = await main({
    idea: "我想做 AI PRD 工具",
    answers: [{ questionId: "q_target_user", selectedOptions: ["indie_dev"] }]
  }, {});

  assert.equal(result.ok, true);
  assert.equal(result.data.project.title, "AI PRD 生成器");
  assert.equal(result.data.project.modelInfo.researchProvider, "doubao");
  assert.equal(result.data.project.risks[0].source, "竞品强度");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/cloudfunctions/generateIncubationAnalysis.test.js
```

Expected: FAIL because handler does not exist.

- [ ] **Step 3: Implement handler and index**

Create `cloudfunctions/generateIncubationAnalysis/handler.js`:

```js
const { createRequestId, okResponse, normalizeError, appError } = require("./_shared/response");
const { renderResearchPrompt } = require("./_shared/prompts/incubation");
const { validateIdea, normalizeAnswers, normalizeAnalysisPayload } = require("./_shared/validators/incubation");

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw appError("AI_OUTPUT_INVALID", "ai_output", "调研结果不是有效 JSON", "retry");
  }
}

function createGenerateIncubationAnalysis({ gateway, now }) {
  return async (event) => {
    const requestId = createRequestId(now);

    try {
      const idea = validateIdea(event && event.idea);
      const answers = normalizeAnswers(event && event.answers);
      const prompt = renderResearchPrompt({ idea, answers });
      const modelResult = await gateway.callModel({
        taskType: "web_research",
        provider: event && event.provider,
        model: event && event.model,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search" }],
        temperature: 0.1,
        requestId
      });
      const analysis = normalizeAnalysisPayload(parseJson(modelResult.text));

      return okResponse({
        project: {
          sourceIdea: idea,
          answers,
          ...analysis,
          modelInfo: {
            reasoningProvider: "deepseek",
            reasoningModel: process.env.AI_REASONING_MODEL || process.env.AI_MODEL || "deepseek-v4-pro",
            researchProvider: modelResult.provider,
            researchModel: modelResult.model
          },
          favoriteStatus: false,
          compareStatus: false
        }
      }, requestId);
    } catch (error) {
      return normalizeError(error, requestId);
    }
  };
}

module.exports = {
  createGenerateIncubationAnalysis
};
```

Create `cloudfunctions/generateIncubationAnalysis/index.js`:

```js
const cloud = require("wx-server-sdk");
const { createAiGateway } = require("./_shared/ai-gateway");
const { createGenerateIncubationAnalysis } = require("./handler");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = createGenerateIncubationAnalysis({
  gateway: createAiGateway(),
  now: () => new Date().toISOString()
});
```

Create `package.json` and `tsconfig.json` in this function by copying the `createIncubationQuestions` versions and changing package name to `"generate-incubation-analysis"`.

- [ ] **Step 4: Sync shared modules and run test**

Run:

```bash
pnpm run cloudfunctions:sync-shared
node --test tests/cloudfunctions/generateIncubationAnalysis.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add cloudfunctions/generateIncubationAnalysis tests/cloudfunctions/generateIncubationAnalysis.test.js
git commit -m "feat: add incubation analysis cloud function"
```

---

### Task 9: Save and List Generated Project Cloud Functions

**Files:**
- Create: `cloudfunctions/saveGeneratedProject/package.json`
- Create: `cloudfunctions/saveGeneratedProject/tsconfig.json`
- Create: `cloudfunctions/saveGeneratedProject/index.js`
- Create: `cloudfunctions/saveGeneratedProject/handler.js`
- Create: `cloudfunctions/listGeneratedProjects/package.json`
- Create: `cloudfunctions/listGeneratedProjects/tsconfig.json`
- Create: `cloudfunctions/listGeneratedProjects/index.js`
- Create: `cloudfunctions/listGeneratedProjects/handler.js`
- Create: `tests/cloudfunctions/saveGeneratedProject.test.js`
- Create: `tests/cloudfunctions/listGeneratedProjects.test.js`

- [ ] **Step 1: Write failing save handler test**

Create `tests/cloudfunctions/saveGeneratedProject.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { createSaveGeneratedProject } = require("../../cloudfunctions/saveGeneratedProject/handler");

const project = {
  sourceIdea: "做 AI PRD",
  answers: [],
  title: "AI PRD 生成器",
  conclusion: "建议做",
  limitedInfo: false,
  limitedInfoReason: "",
  domesticProducts: [],
  globalProducts: [],
  entryDirection: "开发者 PRD",
  advantages: ["熟悉开发者"],
  risks: [{ description: "获客难", source: "获客难度" }],
  suggestions: [{ priority: "P0", action: "发帖验证", expectedSignal: "10 个回复" }],
  researchSources: [],
  modelInfo: { reasoningProvider: "deepseek", reasoningModel: "deepseek-v4-pro", researchProvider: "doubao", researchModel: "doubao-web" },
  favoriteStatus: false,
  compareStatus: false
};

test("rejects unauthenticated save", async () => {
  const main = createSaveGeneratedProject({
    getWXContext: () => ({}),
    repo: {},
    now: () => "2026-06-01T00:00:00.000Z"
  });

  const result = await main({ project }, {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "UNAUTHENTICATED");
});

test("saves current user's project", async () => {
  const main = createSaveGeneratedProject({
    getWXContext: () => ({ OPENID: "openid_1" }),
    repo: {
      async saveProject(payload) {
        assert.equal(payload.openid, "openid_1");
        assert.equal(payload.project.title, "AI PRD 生成器");
        return { id: "asset_1", ...payload.project, createdAt: "2026-06-01T00:00:00.000Z" };
      }
    },
    now: () => "2026-06-01T00:00:00.000Z"
  });

  const result = await main({ project }, {});

  assert.equal(result.ok, true);
  assert.equal(result.data.project.id, "asset_1");
});
```

- [ ] **Step 2: Write failing list handler test**

Create `tests/cloudfunctions/listGeneratedProjects.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { createListGeneratedProjects } = require("../../cloudfunctions/listGeneratedProjects/handler");

test("rejects unauthenticated list", async () => {
  const main = createListGeneratedProjects({
    getWXContext: () => ({}),
    repo: {},
    now: () => "2026-06-01T00:00:00.000Z"
  });

  const result = await main({}, {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "UNAUTHENTICATED");
});

test("lists current user's projects", async () => {
  const main = createListGeneratedProjects({
    getWXContext: () => ({ OPENID: "openid_1" }),
    repo: {
      async listProjects(payload) {
        assert.equal(payload.openid, "openid_1");
        assert.equal(payload.pageSize, 2);
        return { items: [{ id: "asset_1", title: "AI PRD" }], page: 1, pageSize: 2, total: 1 };
      }
    },
    now: () => "2026-06-01T00:00:00.000Z"
  });

  const result = await main({ page_size: 2 }, {});

  assert.equal(result.ok, true);
  assert.equal(result.data.items[0].id, "asset_1");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
node --test tests/cloudfunctions/saveGeneratedProject.test.js tests/cloudfunctions/listGeneratedProjects.test.js
```

Expected: FAIL because handlers do not exist.

- [ ] **Step 4: Implement save handler and index**

Create `cloudfunctions/saveGeneratedProject/handler.js`:

```js
const { createRequestId, okResponse, normalizeError, appError } = require("./_shared/response");

function createSaveGeneratedProject({ getWXContext, repo, now }) {
  return async (event) => {
    const requestId = createRequestId(now);

    try {
      const wxContext = getWXContext();

      if (!wxContext.OPENID) {
        throw appError("UNAUTHENTICATED", "authentication", "未获取到用户身份", "login");
      }

      const project = await repo.saveProject({
        openid: wxContext.OPENID,
        userId: "",
        project: event && event.project
      });

      return okResponse({ project }, requestId);
    } catch (error) {
      return normalizeError(error, requestId);
    }
  };
}

module.exports = {
  createSaveGeneratedProject
};
```

Create `cloudfunctions/saveGeneratedProject/index.js`:

```js
const cloud = require("wx-server-sdk");
const { createGeneratedProjectRepository } = require("./_shared/generated-projects");
const { createSaveGeneratedProject } = require("./handler");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

function createId() {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const db = cloud.database();

exports.main = createSaveGeneratedProject({
  getWXContext: () => cloud.getWXContext(),
  repo: createGeneratedProjectRepository({
    db,
    now: () => new Date().toISOString(),
    createId
  }),
  now: () => new Date().toISOString()
});
```

- [ ] **Step 5: Implement list handler and index**

Create `cloudfunctions/listGeneratedProjects/handler.js`:

```js
const { createRequestId, okResponse, normalizeError, appError } = require("./_shared/response");

function createListGeneratedProjects({ getWXContext, repo, now }) {
  return async (event) => {
    const requestId = createRequestId(now);

    try {
      const wxContext = getWXContext();

      if (!wxContext.OPENID) {
        throw appError("UNAUTHENTICATED", "authentication", "未获取到用户身份", "login");
      }

      const result = await repo.listProjects({
        openid: wxContext.OPENID,
        assetId: event && event.asset_id,
        page: event && event.page,
        pageSize: event && event.page_size
      });

      return okResponse(result, requestId);
    } catch (error) {
      return normalizeError(error, requestId);
    }
  };
}

module.exports = {
  createListGeneratedProjects
};
```

Create `cloudfunctions/listGeneratedProjects/index.js`:

```js
const cloud = require("wx-server-sdk");
const { createGeneratedProjectRepository } = require("./_shared/generated-projects");
const { createListGeneratedProjects } = require("./handler");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = createListGeneratedProjects({
  getWXContext: () => cloud.getWXContext(),
  repo: createGeneratedProjectRepository({
    db,
    now: () => new Date().toISOString(),
    createId: () => `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }),
  now: () => new Date().toISOString()
});
```

Create `package.json` and `tsconfig.json` in both function directories by copying `createIncubationQuestions` versions and setting package names to `"save-generated-project"` and `"list-generated-projects"`.

- [ ] **Step 6: Sync shared modules and run tests**

Run:

```bash
pnpm run cloudfunctions:sync-shared
node --test tests/cloudfunctions/saveGeneratedProject.test.js tests/cloudfunctions/listGeneratedProjects.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add cloudfunctions/saveGeneratedProject cloudfunctions/listGeneratedProjects tests/cloudfunctions/saveGeneratedProject.test.js tests/cloudfunctions/listGeneratedProjects.test.js
git commit -m "feat: add generated project asset functions"
```

---

### Task 10: Mini Program Cloud Function Client

**Files:**
- Create: `lib/cloud-functions.js`
- Create: `tests/cloud-functions.test.js`

- [ ] **Step 1: Write failing client tests**

Create `tests/cloud-functions.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { createCloudFunctionClient, createFriendlyErrorMessage } = require("../lib/cloud-functions");

test("calls wx.cloud.callFunction and unwraps data", async () => {
  const calls = [];
  const client = createCloudFunctionClient({
    callFunction({ name, data, success }) {
      calls.push({ name, data });
      success({ result: { ok: true, data: { value: 1 }, request_id: "req_1" } });
    }
  });

  const result = await client.call("demo", { a: 1 });

  assert.deepEqual(result, { value: 1 });
  assert.equal(calls[0].name, "demo");
});

test("throws typed backend errors", async () => {
  const client = createCloudFunctionClient({
    callFunction({ success }) {
      success({
        result: {
          ok: false,
          error: { code: "MODEL_NOT_CONFIGURED", type: "configuration", message: "调研模型未配置", action: "configure_model" },
          request_id: "req_2"
        }
      });
    }
  });

  await assert.rejects(
    () => client.call("demo", {}),
    (error) => {
      assert.equal(error.code, "MODEL_NOT_CONFIGURED");
      assert.equal(error.type, "configuration");
      return true;
    }
  );
});

test("maps typed errors to friendly messages", () => {
  assert.equal(
    createFriendlyErrorMessage({ code: "MODEL_NOT_CONFIGURED", type: "configuration", message: "调研模型未配置" }),
    "调研模型未配置，请检查云函数环境变量。"
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/cloud-functions.test.js
```

Expected: FAIL because client module does not exist.

- [ ] **Step 3: Implement cloud function client**

Create `lib/cloud-functions.js`:

```js
function createBackendError(payload) {
  const error = new Error(payload.message || "服务暂时不可用");
  error.code = payload.code || "UNKNOWN_ERROR";
  error.type = payload.type || "unknown";
  error.action = payload.action || "retry";
  return error;
}

function createCloudFunctionClient(cloud) {
  function call(name, data) {
    return new Promise((resolve, reject) => {
      cloud.callFunction({
        name,
        data,
        success(res) {
          const result = res && res.result;

          if (result && result.ok) {
            resolve(result.data);
            return;
          }

          if (result && result.error) {
            reject(createBackendError(result.error));
            return;
          }

          reject(createBackendError({ code: "UNKNOWN_ERROR", type: "unknown", message: "云函数返回异常", action: "retry" }));
        },
        fail(error) {
          reject(createBackendError({ code: "NETWORK_ERROR", type: "network", message: error && error.errMsg || "网络请求失败", action: "retry" }));
        }
      });
    });
  }

  return {
    call
  };
}

function createFriendlyErrorMessage(error) {
  if (error && error.code === "MODEL_NOT_CONFIGURED") {
    return "调研模型未配置，请检查云函数环境变量。";
  }

  if (error && error.code === "MODEL_AUTH_FAILED") {
    return "模型鉴权失败，请检查 API Key。";
  }

  if (error && error.type === "validation") {
    return error.message || "输入信息不完整，请修改后重试。";
  }

  if (error && error.type === "network") {
    return "网络连接失败，请稍后重试。";
  }

  return error && error.message ? error.message : "服务暂时不可用，请稍后重试。";
}

module.exports = {
  createCloudFunctionClient,
  createFriendlyErrorMessage
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/cloud-functions.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/cloud-functions.js tests/cloud-functions.test.js
git commit -m "feat: add mini program cloud function client"
```

---

### Task 11: Tab1 Backend Incubation Flow

**Files:**
- Modify: `pages/find/index.js`
- Modify: `pages/find/index.wxml`
- Modify: `pages/find/index.wxss`

- [ ] **Step 1: Replace Tab1 page logic**

Modify `pages/find/index.js` to use this structure:

```js
const { createCloudFunctionClient, createFriendlyErrorMessage } = require("../../lib/cloud-functions");

const examples = [
  "AI 帮我整理小红书选题",
  "给自由职业者做报价管理工具",
  "帮程序员快速生成项目 PRD",
  "面向本地商家的会员小程序"
];

const researchSteps = [
  "正在联网查询国内外优秀产品",
  "正在对比产品优劣",
  "正在分析产品方向"
];

function createStageText(stage) {
  const map = {
    creating_questions: "正在补充关键信息",
    questioning: "正在补充关键信息",
    researching: "正在调研市场",
    result: "已生成方向建议",
    saving: "正在保存方向"
  };

  return map[stage] || "AI灵感孵化";
}

function createSelectedOptionMap(values) {
  return (values || []).reduce((map, value) => {
    map[value] = true;
    return map;
  }, {});
}

Page({
  data: {
    ideaInput: "",
    ideaAutosize: { minRows: 4, maxRows: 7 },
    customAutosize: { minRows: 2, maxRows: 4 },
    examples,
    recentProjects: [],
    loadingRecent: false,
    modalVisible: false,
    stage: "idle",
    stageText: "AI灵感孵化",
    questions: [],
    currentQuestionIndex: 0,
    answers: [],
    currentSelectedOptions: [],
    selectedOptionMap: {},
    currentCustomInput: "",
    researchSteps,
    activeResearchStep: 0,
    projectResult: null,
    errorMessage: ""
  },

  onLoad() {
    this.client = createCloudFunctionClient(wx.cloud);
    this.loadRecentProjects();
  },

  async loadRecentProjects() {
    this.setData({ loadingRecent: true });

    try {
      const data = await this.client.call("listGeneratedProjects", { page: 1, page_size: 3 });
      this.setData({ recentProjects: data.items || [] });
    } catch (error) {
      this.setData({ errorMessage: createFriendlyErrorMessage(error) });
    } finally {
      this.setData({ loadingRecent: false });
    }
  },

  onIdeaInput(event) {
    this.setData({ ideaInput: event.detail.value });
  },

  onSelectExample(event) {
    this.setData({ ideaInput: event.currentTarget.dataset.value });
  },

  async onStartIncubation() {
    const idea = this.data.ideaInput.trim();

    if (!idea) {
      return;
    }

    this.setData({
      modalVisible: true,
      stage: "creating_questions",
      stageText: createStageText("creating_questions"),
      errorMessage: "",
      questions: [],
      answers: [],
      currentQuestionIndex: 0,
      currentSelectedOptions: [],
      selectedOptionMap: {},
      currentCustomInput: "",
      projectResult: null
    });

    try {
      const data = await this.client.call("createIncubationQuestions", { idea });
      this.setData({
        stage: "questioning",
        stageText: createStageText("questioning"),
        questions: data.questions || []
      });
    } catch (error) {
      this.setData({ errorMessage: createFriendlyErrorMessage(error) });
    }
  },

  onCloseModal() {
    this.setData({ modalVisible: false });
  },

  onSelectOption(event) {
    const value = event.currentTarget.dataset.value;
    const question = this.data.questions[this.data.currentQuestionIndex];
    const selected = this.data.currentSelectedOptions.slice();
    const existingIndex = selected.indexOf(value);

    if (question.type === "multiple") {
      if (existingIndex >= 0) {
        selected.splice(existingIndex, 1);
      } else {
        selected.push(value);
      }
    } else {
      selected.splice(0, selected.length, value);
    }

    this.setData({
      currentSelectedOptions: selected,
      selectedOptionMap: createSelectedOptionMap(selected)
    });
  },

  onCustomInput(event) {
    this.setData({ currentCustomInput: event.detail.value });
  },

  saveCurrentAnswer() {
    const question = this.data.questions[this.data.currentQuestionIndex];
    const answers = this.data.answers.slice();
    const answer = {
      questionId: question.questionId,
      questionTitle: question.title,
      selectedOptions: this.data.currentSelectedOptions,
      customInput: this.data.currentCustomInput
    };
    answers[this.data.currentQuestionIndex] = answer;
    this.setData({ answers });
    return answers;
  },

  onPreviousQuestion() {
    if (this.data.currentQuestionIndex <= 0) {
      return;
    }

    const nextIndex = this.data.currentQuestionIndex - 1;
    const previousAnswer = this.data.answers[nextIndex] || {};

    this.setData({
      currentQuestionIndex: nextIndex,
      currentSelectedOptions: previousAnswer.selectedOptions || [],
      selectedOptionMap: createSelectedOptionMap(previousAnswer.selectedOptions || []),
      currentCustomInput: previousAnswer.customInput || ""
    });
  },

  onNextQuestion() {
    const answers = this.saveCurrentAnswer();
    const nextIndex = this.data.currentQuestionIndex + 1;

    if (nextIndex >= this.data.questions.length) {
      this.startResearch(answers);
      return;
    }

    const nextAnswer = answers[nextIndex] || {};
    this.setData({
      currentQuestionIndex: nextIndex,
      currentSelectedOptions: nextAnswer.selectedOptions || [],
      selectedOptionMap: createSelectedOptionMap(nextAnswer.selectedOptions || []),
      currentCustomInput: nextAnswer.customInput || ""
    });
  },

  async startResearch(answers) {
    this.setData({
      stage: "researching",
      stageText: createStageText("researching"),
      activeResearchStep: 0,
      errorMessage: ""
    });

    const timer = setInterval(() => {
      if (this.data.stage === "researching" && this.data.activeResearchStep < 2) {
        this.setData({ activeResearchStep: this.data.activeResearchStep + 1 });
      }
    }, 1200);

    try {
      const data = await this.client.call("generateIncubationAnalysis", {
        idea: this.data.ideaInput.trim(),
        answers
      });
      clearInterval(timer);
      this.setData({
        stage: "result",
        stageText: createStageText("result"),
        activeResearchStep: 2,
        projectResult: data.project
      });
    } catch (error) {
      clearInterval(timer);
      this.setData({ errorMessage: createFriendlyErrorMessage(error) });
    }
  },

  async onConfirmProject() {
    if (!this.data.projectResult) {
      return;
    }

    this.setData({ stage: "saving", stageText: createStageText("saving"), errorMessage: "" });

    try {
      await this.client.call("saveGeneratedProject", { project: this.data.projectResult });
      wx.switchTab({ url: "/pages/workspace/index" });
    } catch (error) {
      this.setData({
        stage: "result",
        stageText: createStageText("result"),
        errorMessage: createFriendlyErrorMessage(error)
      });
    }
  },

  onRegenerate() {
    this.startResearch(this.data.answers);
  },

  onEditDirection() {
    const firstAnswer = this.data.answers[0] || {};
    this.setData({
      stage: "questioning",
      stageText: createStageText("questioning"),
      currentQuestionIndex: 0,
      currentSelectedOptions: firstAnswer.selectedOptions || [],
      selectedOptionMap: createSelectedOptionMap(firstAnswer.selectedOptions || []),
      currentCustomInput: firstAnswer.customInput || "",
      projectResult: null
    });
  }
});
```

- [ ] **Step 2: Replace Tab1 WXML**

Modify `pages/find/index.wxml` to render the incubation page. Use native `wx:if` blocks and existing TDesign components:

```xml
<view class="page find-page">
  <view class="hero">
    <view class="eyebrow">AI INCUBATION</view>
    <view class="title">灵感孵化</view>
    <view class="subtitle">输入一个项目想法，AI 会追问关键信息，并调研国内外产品，帮你找到可切入方向。</view>
  </view>

  <view class="idea-card">
    <t-textarea class="idea-input" value="{{ideaInput}}" placeholder="例如：我想做一个帮独立开发者找项目方向的小工具" autosize="{{ideaAutosize}}" bind:change="onIdeaInput" />
    <t-button block theme="primary" size="large" disabled="{{!ideaInput}}" bind:tap="onStartIncubation">开始孵化</t-button>
  </view>

  <view class="section">
    <view class="section-title">示例灵感</view>
    <view class="example-grid">
      <t-button wx:for="{{examples}}" wx:key="*this" class="example-chip" variant="outline" data-value="{{item}}" bind:tap="onSelectExample">{{item}}</t-button>
    </view>
  </view>

  <view class="section">
    <view class="section-title">最近孵化</view>
    <block wx:if="{{recentProjects.length}}">
      <view wx:for="{{recentProjects}}" wx:key="id" class="recent-card">
        <view class="recent-title">{{item.title}}</view>
        <view class="recent-text">{{item.entryDirection}}</view>
        <view class="recent-meta">{{item.createdAt}}</view>
      </view>
    </block>
    <t-empty wx:else description="孵化完成的项目会保存到工作台。" />
  </view>

  <view class="ai-note">市场调研结果由 AI 生成，请结合真实数据进一步验证。</view>

  <view wx:if="{{modalVisible}}" class="incubation-modal">
    <view class="modal-header">
      <t-icon name="close" size="44rpx" bind:tap="onCloseModal" />
      <view class="modal-title-wrap">
        <view class="modal-title">AI灵感孵化</view>
        <view class="modal-stage"><t-icon name="chat" size="28rpx" />{{stageText}}</view>
      </view>
      <view></view>
    </view>

    <scroll-view scroll-y class="modal-body">
      <view wx:if="{{errorMessage}}" class="error-card">{{errorMessage}}</view>

      <view wx:if="{{stage === 'creating_questions'}}" class="progress-card">
        <t-loading theme="spinner" size="48rpx" />
        <view class="progress-text">正在生成追问问题...</view>
      </view>

      <view wx:if="{{stage === 'questioning' && questions.length}}" class="question-card">
        <view class="question-title">{{questions[currentQuestionIndex].title}}</view>
        <view class="question-desc">{{questions[currentQuestionIndex].description}}</view>
        <view class="option-list">
          <t-button wx:for="{{questions[currentQuestionIndex].options}}" wx:key="value" class="option-item {{selectedOptionMap[item.value] ? 'option-selected' : ''}}" theme="{{selectedOptionMap[item.value] ? 'primary' : 'default'}}" variant="{{selectedOptionMap[item.value] ? 'base' : 'outline'}}" data-value="{{item.value}}" bind:tap="onSelectOption">{{item.label}}</t-button>
        </view>
        <t-textarea wx:if="{{questions[currentQuestionIndex].allowCustomInput}}" class="custom-input" value="{{currentCustomInput}}" placeholder="也可以补充说明" autosize="{{customAutosize}}" bind:change="onCustomInput" />
      </view>

      <view wx:if="{{stage === 'researching'}}" class="progress-card">
        <view wx:for="{{researchSteps}}" wx:key="*this" class="progress-row">
          <view class="progress-dot {{index < activeResearchStep ? 'done' : ''}} {{index === activeResearchStep ? 'active' : ''}}">{{index < activeResearchStep ? '✓' : ''}}</view>
          <view class="progress-text">{{item}}</view>
        </view>
      </view>

      <view wx:if="{{stage === 'result' && projectResult}}" class="result-card">
        <view class="result-title">{{projectResult.title}}</view>
        <view class="result-section"><view class="result-heading">方向结论</view><view class="result-text">{{projectResult.conclusion}}</view></view>
        <view class="result-section"><view class="result-heading">推荐切入方向</view><view class="result-text">{{projectResult.entryDirection}}</view></view>
        <view class="result-section"><view class="result-heading">国内产品</view><view wx:for="{{projectResult.domesticProducts}}" wx:key="name" class="product-row"><view class="product-name">{{item.name}}</view><view class="product-text">{{item.positioning}}</view><view class="product-text">优势：{{item.strengths}}</view><view class="product-text">短板：{{item.weaknesses}}</view></view></view>
        <view class="result-section"><view class="result-heading">国外产品</view><view wx:for="{{projectResult.globalProducts}}" wx:key="name" class="product-row"><view class="product-name">{{item.name}}</view><view class="product-text">{{item.positioning}}</view><view class="product-text">优势：{{item.strengths}}</view><view class="product-text">短板：{{item.weaknesses}}</view></view></view>
        <view class="result-section"><view class="result-heading">风险</view><view wx:for="{{projectResult.risks}}" wx:key="description" class="risk-row"><view class="risk-desc">{{item.description}}</view><view class="risk-source">来源：{{item.source}}</view></view></view>
        <view class="result-section"><view class="result-heading">建议</view><view wx:for="{{projectResult.suggestions}}" wx:key="action" class="bullet-line">{{item.priority}} · {{item.action}} · {{item.expectedSignal}}</view></view>
      </view>
    </scroll-view>

    <view class="modal-actions">
      <t-button wx:if="{{stage === 'questioning'}}" class="secondary-button" variant="outline" disabled="{{currentQuestionIndex === 0}}" bind:tap="onPreviousQuestion">上一步</t-button>
      <t-button wx:if="{{stage === 'questioning'}}" class="action-primary" theme="primary" bind:tap="onNextQuestion">{{currentQuestionIndex === questions.length - 1 ? '开始调研市场' : '下一步'}}</t-button>
      <t-button wx:if="{{stage === 'result'}}" class="secondary-button" variant="outline" bind:tap="onRegenerate">重新生成</t-button>
      <t-button wx:if="{{stage === 'result'}}" class="secondary-button" variant="outline" bind:tap="onEditDirection">修改方向</t-button>
      <t-button wx:if="{{stage === 'result'}}" class="action-primary" theme="primary" bind:tap="onConfirmProject">确定方向</t-button>
    </view>
  </view>
</view>
```

- [ ] **Step 3: Add missing Tab1 error style**

Append to `pages/find/index.wxss`:

```css
.error-card {
  margin-bottom: 20rpx;
  padding: 18rpx;
  border: 1rpx solid #fecaca;
  border-radius: 12rpx;
  background: #fef2f2;
  color: #991b1b;
  font-size: 25rpx;
  line-height: 1.5;
}

.option-selected {
  font-weight: 700;
}
```

- [ ] **Step 4: Manual Mini Program check**

Open WeChat DevTools and verify:

- Tab1 title is `灵感孵化`.
- Empty input disables `开始孵化`.
- Example chips fill the input.
- Starting incubation calls `createIncubationQuestions`.
- If backend returns `MODEL_NOT_CONFIGURED`, the modal shows a configuration message.

- [ ] **Step 5: Commit**

Run:

```bash
git add pages/find/index.js pages/find/index.wxml pages/find/index.wxss
git commit -m "feat: wire Tab1 to AI incubation backend"
```

---

### Task 12: Tab4 Workspace List and Detail

**Files:**
- Modify: `pages/workspace/index.js`
- Modify: `pages/workspace/index.wxml`
- Modify: `pages/workspace/index.wxss`

- [ ] **Step 1: Replace workspace page logic**

Modify `pages/workspace/index.js`:

```js
const { createCloudFunctionClient, createFriendlyErrorMessage } = require("../../lib/cloud-functions");

Page({
  data: {
    projects: [],
    loading: false,
    errorMessage: "",
    detailVisible: false,
    selectedProject: null
  },

  onLoad() {
    this.client = createCloudFunctionClient(wx.cloud);
  },

  onShow() {
    this.loadProjects();
  },

  async loadProjects() {
    this.setData({ loading: true, errorMessage: "" });

    try {
      const data = await this.client.call("listGeneratedProjects", { page: 1, page_size: 20 });
      this.setData({ projects: data.items || [] });
    } catch (error) {
      this.setData({ errorMessage: createFriendlyErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  onOpenDetail(event) {
    const id = event.currentTarget.dataset.id;
    const selectedProject = this.data.projects.find((project) => project.id === id);
    this.setData({ selectedProject, detailVisible: Boolean(selectedProject) });
  },

  onCloseDetail() {
    this.setData({ detailVisible: false, selectedProject: null });
  },

  onComingSoon() {
    wx.showToast({
      title: "即将支持",
      icon: "none"
    });
  }
});
```

- [ ] **Step 2: Replace workspace WXML**

Modify `pages/workspace/index.wxml`:

```xml
<view class="page workspace-page">
  <view class="eyebrow">WORKSPACE</view>
  <view class="title">工作台</view>
  <view class="subtitle">这里承接从灵感孵化确定的项目方向，你可以继续查看详情、收藏、对比或生成 PRD。</view>

  <view wx:if="{{errorMessage}}" class="error-card">{{errorMessage}}</view>

  <block wx:if="{{projects.length}}">
    <view wx:for="{{projects}}" wx:key="id" class="project-card" data-id="{{item.id}}" bind:tap="onOpenDetail">
      <view class="project-header">
        <view class="project-title">{{item.title}}</view>
        <t-tag theme="{{item.limitedInfo ? 'warning' : 'success'}}">{{item.limitedInfo ? '信息有限' : '已调研'}}</t-tag>
      </view>
      <view class="project-text">{{item.conclusion}}</view>
      <view class="project-text entry-text">{{item.entryDirection}}</view>
      <view class="project-meta">风险 {{item.risks.length}} 个 · {{item.createdAt}}</view>
      <view class="project-actions" catchtap="onComingSoon">
        <t-button class="project-action" size="small" variant="outline">收藏</t-button>
        <t-button class="project-action" size="small" variant="outline">对比</t-button>
        <t-button class="project-action prd-action" size="small" theme="primary">生成PRD</t-button>
      </view>
    </view>
  </block>
  <t-empty wx:else description="去「找项目」输入一个项目想法，AI 会帮你孵化方向并保存到这里。" />

  <view wx:if="{{detailVisible && selectedProject}}" class="detail-modal">
    <view class="detail-header">
      <t-icon name="close" size="44rpx" bind:tap="onCloseDetail" />
      <view class="detail-title">项目详情</view>
      <view></view>
    </view>
    <scroll-view scroll-y class="detail-body">
      <view class="detail-card">
        <view class="detail-project-title">{{selectedProject.title}}</view>
        <view class="detail-section"><view class="detail-heading">方向结论</view><view class="detail-text">{{selectedProject.conclusion}}</view></view>
        <view class="detail-section"><view class="detail-heading">推荐切入方向</view><view class="detail-text entry-text">{{selectedProject.entryDirection}}</view></view>
        <view class="detail-section"><view class="detail-heading">可切入优势</view><view wx:for="{{selectedProject.advantages}}" wx:key="*this" class="bullet-line">• {{item}}</view></view>
        <view class="detail-section"><view class="detail-heading">国内产品</view><view wx:for="{{selectedProject.domesticProducts}}" wx:key="name" class="product-row"><view class="product-name">{{item.name}}</view><view class="product-text">{{item.positioning}}</view><view class="product-text">优势：{{item.strengths}}</view><view class="product-text">短板：{{item.weaknesses}}</view><view class="product-text">证据：{{item.evidence}}</view></view></view>
        <view class="detail-section"><view class="detail-heading">国外产品</view><view wx:for="{{selectedProject.globalProducts}}" wx:key="name" class="product-row"><view class="product-name">{{item.name}}</view><view class="product-text">{{item.positioning}}</view><view class="product-text">优势：{{item.strengths}}</view><view class="product-text">短板：{{item.weaknesses}}</view><view class="product-text">证据：{{item.evidence}}</view></view></view>
        <view class="detail-section"><view class="detail-heading">风险</view><view wx:for="{{selectedProject.risks}}" wx:key="description" class="risk-row"><view class="risk-desc">{{item.description}}</view><view class="risk-source">来源：{{item.source}}</view></view></view>
        <view class="detail-section"><view class="detail-heading">建议</view><view wx:for="{{selectedProject.suggestions}}" wx:key="action" class="bullet-line">{{item.priority}} · {{item.action}} · {{item.expectedSignal}}</view></view>
        <view class="detail-section"><view class="detail-heading">调研来源</view><view wx:for="{{selectedProject.researchSources}}" wx:key="title" class="bullet-line">{{item.title}}：{{item.summary}}</view></view>
      </view>
    </scroll-view>
  </view>
</view>
```

- [ ] **Step 3: Add missing workspace error style**

Append to `pages/workspace/index.wxss`:

```css
.error-card {
  margin-top: 24rpx;
  padding: 18rpx;
  border: 1rpx solid #fecaca;
  border-radius: 12rpx;
  background: #fef2f2;
  color: #991b1b;
  font-size: 25rpx;
  line-height: 1.5;
}
```

- [ ] **Step 4: Manual Mini Program check**

Open WeChat DevTools and verify:

- Workspace loads `listGeneratedProjects` on tab show.
- Empty workspace shows the empty state.
- A saved project appears in the list.
- Tapping a project opens detail.
- Detail matches the final result structure and does not call model functions.
- 收藏/对比/生成 PRD show `即将支持`.

- [ ] **Step 5: Commit**

Run:

```bash
git add pages/workspace/index.js pages/workspace/index.wxml pages/workspace/index.wxss
git commit -m "feat: show incubated projects in workspace"
```

---

### Task 13: Verification Pass

**Files:**
- No new files unless fixes are required.

- [ ] **Step 1: Run all unit tests**

Run:

```bash
node --test tests/*.test.js tests/cloudfunctions/*.test.js
```

Expected: PASS for all tests.

- [ ] **Step 2: Run cloud function typechecks**

Run:

```bash
cd cloudfunctions/createIncubationQuestions && pnpm install && pnpm run typecheck
cd ../generateIncubationAnalysis && pnpm install && pnpm run typecheck
cd ../saveGeneratedProject && pnpm install && pnpm run typecheck
cd ../listGeneratedProjects && pnpm install && pnpm run typecheck
```

Expected: each function typecheck exits 0.

- [ ] **Step 3: Sync shared modules one final time**

Run:

```bash
pnpm run cloudfunctions:sync-shared
git status --short
```

Expected: no unexpected changes besides intentional synced shared copies.

- [ ] **Step 4: Manual cloud setup**

In CloudBase / WeChat DevTools:

1. Create `generated_assets` collection if it does not exist.
2. Configure cloud function environment variables:
   - `AI_REASONING_PROVIDER=deepseek`
   - `AI_REASONING_MODEL=deepseek-v4-pro`
   - `DEEPSEEK_API_KEY=<user-provided-key>`
   - `DEEPSEEK_BASE_URL=https://api.deepseek.com`
   - `AI_WEB_RESEARCH_PROVIDER=doubao`
   - `AI_WEB_RESEARCH_MODEL=<user-provided-web-search-model>`
   - `ARK_API_KEY=<user-provided-key>`
   - `ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3`
3. Upload and deploy these functions with cloud install dependencies:
   - `createIncubationQuestions`
   - `generateIncubationAnalysis`
   - `saveGeneratedProject`
   - `listGeneratedProjects`

- [ ] **Step 5: Manual end-to-end check**

In the Mini Program:

1. Open Tab1.
2. Enter `我想做一个帮独立开发者快速生成项目 PRD 的小工具`.
3. Tap `开始孵化`.
4. Answer generated questions.
5. Tap `开始调研市场`.
6. Confirm result contains domestic products, global products, risks with sources, suggestions, and research sources.
7. Tap `确定方向`.
8. Verify app switches to Tab4.
9. Verify saved project appears in workspace.
10. Open detail and confirm it matches the generated result.

- [ ] **Step 6: Commit verification fixes if any**

If verification required fixes, commit them:

```bash
git add <fixed-files>
git commit -m "fix: stabilize AI incubation loop"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: This plan covers model gateway, DeepSeek reasoning, Doubao web research, environment placeholders, prompt templates, typed errors, generated asset persistence, Tab1 flow, Tab4 list/detail, and verification.
- Deferred scope: User-facing model selection, PRD generation, comparison actions, payment, and streaming progress are intentionally excluded per spec.
- Type consistency: Frontend uses camelCase `GeneratedProject`; database helpers map to snake_case `generated_assets`; cloud function responses use `ok/data/error/request_id`; typed errors always include `code/type/action`.
