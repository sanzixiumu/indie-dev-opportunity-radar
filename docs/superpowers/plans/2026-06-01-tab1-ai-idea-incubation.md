# Tab1 AI Idea Incubation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Tab1 “灵感孵化” experience with a full-screen AI incubation flow, structured analysis result, and handoff into the workspace project list.

**Architecture:** Keep the UI in the existing WeChat Mini Program pages and use TDesign Mini Program components wherever they can cover the interaction. Add two small CommonJS modules under `lib/`: one for generated project persistence and one for deterministic mock AI incubation behavior. Tab1 owns idea input, dynamic question display, progress, and result confirmation; Tab4 workspace owns saved generated projects, list actions, and details.

**Tech Stack:** WeChat Mini Program WXML/WXSS/JS, TDesign Mini Program (`tdesign-miniprogram`), CommonJS modules, `wx` storage APIs, Node built-in test runner for pure logic modules.

---

## File Structure

- Create `lib/generated-project-store.js`: storage adapter for generated projects shared by Tab1 and workspace.
- Create `lib/incubation-service.js`: deterministic mock service that returns dynamic questions and a structured generated project; later replace its internals with real model calls.
- Create `tests/generated-project-store.test.js`: unit tests for save, list, newest-first ordering, favorite toggle, and compare toggle.
- Create `tests/incubation-service.test.js`: unit tests for question generation and result shape.
- Modify `package.json`: add a `test` script using Node's built-in test runner.
- Modify `pages/find/index.json`: register TDesign components used by Tab1.
- Modify `pages/find/index.js`: page state and event handlers for idea input, examples, full-screen modal, AI questions, progress, and result confirmation.
- Modify `pages/find/index.wxml`: Tab1 initial UI and AI incubation full-screen modal.
- Modify `pages/find/index.wxss`: Tab1 layout, modal slide-up shell, question cards, progress steps, result card tables, and fixed actions.
- Modify `pages/workspace/index.json`: register TDesign components used by workspace.
- Modify `pages/workspace/index.js`: load saved projects, toggle favorite/compare, open/close detail modal.
- Modify `pages/workspace/index.wxml`: generated project list and detail modal.
- Modify `pages/workspace/index.wxss`: workspace list cards, action buttons, detail modal, tables, risks.

## Component Usage Rule

Prefer `tdesign-miniprogram` components whenever they can represent the UI:

- Use `t-textarea` for multi-line input.
- Use `t-button` for all buttons.
- Use `t-popup` for the full-screen bottom-up AI incubation modal and workspace detail modal.
- Use `t-icon` for close/check/loading-adjacent icons where useful.
- Use `t-tag` for example ideas, selected options, and risk/status badges.
- Use `t-loading` for active research progress.
- Use `t-empty` for empty states.
- Use `t-divider` for report section separation when spacing needs a component boundary.

Custom WXML/CSS is allowed for report cards, tables, fixed page layout, and product-specific composition that TDesign does not provide directly.

## Task 1: Add Generated Project Store

**Files:**
- Create: `lib/generated-project-store.js`
- Create: `tests/generated-project-store.test.js`
- Modify: `package.json`

- [ ] **Step 1: Add a test script**

Modify `package.json` scripts so it includes:

```json
{
  "scripts": {
    "test": "node --test tests/*.test.js",
    "cloudbase:version": "bunx @cloudbase/cli --version",
    "mcp:status": "bunx mcporter call cloudbase.auth action=status --output json",
    "mcp:envs": "bunx mcporter call cloudbase.envQuery action=list --output json",
    "mcp:describe": "bunx mcporter describe cloudbase --all-parameters"
  }
}
```

- [ ] **Step 2: Write failing store tests**

Create `tests/generated-project-store.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { createGeneratedProjectStore, createMemoryStorage } = require("../lib/generated-project-store");

function sampleProject(overrides = {}) {
  return {
    id: overrides.id || "project-1",
    sourceIdea: "我想做一个帮独立开发者找项目方向的小工具",
    answers: [],
    title: overrides.title || "独立开发者灵感雷达",
    conclusion: "建议做，但需要从细分场景切入。",
    domesticProducts: [],
    globalProducts: [],
    entryDirection: "先做轻量项目方向评估工具。",
    advantages: ["适合小团队快速验证"],
    risks: [{ description: "竞品强", source: "同类 AI 工具已有成熟产品" }],
    suggestions: ["先访谈 5 个独立开发者"],
    createdAt: overrides.createdAt || "2026-06-01T00:00:00.000Z",
    favoriteStatus: false,
    compareStatus: false
  };
}

test("saveProject stores projects newest first", () => {
  const store = createGeneratedProjectStore(createMemoryStorage());

  store.saveProject(sampleProject({ id: "old", createdAt: "2026-06-01T00:00:00.000Z" }));
  store.saveProject(sampleProject({ id: "new", createdAt: "2026-06-01T01:00:00.000Z" }));

  assert.deepEqual(
    store.getProjects().map((project) => project.id),
    ["new", "old"]
  );
});

test("saveProject replaces an existing project with the same id", () => {
  const store = createGeneratedProjectStore(createMemoryStorage());

  store.saveProject(sampleProject({ id: "project-1", title: "旧标题" }));
  store.saveProject(sampleProject({ id: "project-1", title: "新标题" }));

  const projects = store.getProjects();
  assert.equal(projects.length, 1);
  assert.equal(projects[0].title, "新标题");
});

test("toggleFavorite flips favoriteStatus", () => {
  const store = createGeneratedProjectStore(createMemoryStorage());
  store.saveProject(sampleProject({ id: "project-1" }));

  assert.equal(store.toggleFavorite("project-1").favoriteStatus, true);
  assert.equal(store.toggleFavorite("project-1").favoriteStatus, false);
});

test("toggleCompare flips compareStatus", () => {
  const store = createGeneratedProjectStore(createMemoryStorage());
  store.saveProject(sampleProject({ id: "project-1" }));

  assert.equal(store.toggleCompare("project-1").compareStatus, true);
  assert.equal(store.toggleCompare("project-1").compareStatus, false);
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm test
```

Expected: FAIL with `Cannot find module '../lib/generated-project-store'`.

- [ ] **Step 4: Implement the store**

Create `lib/generated-project-store.js`:

```js
const STORAGE_KEY = "generatedProjects";

function createMemoryStorage(initialData) {
  const data = Object.assign({}, initialData);

  return {
    getStorageSync(key) {
      return data[key];
    },
    setStorageSync(key, value) {
      data[key] = value;
    }
  };
}

function resolveStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof wx !== "undefined" && wx.getStorageSync && wx.setStorageSync) {
    return wx;
  }

  return createMemoryStorage();
}

function normalizeProjects(value) {
  return Array.isArray(value) ? value : [];
}

function sortNewestFirst(projects) {
  return projects.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function createGeneratedProjectStore(storage) {
  const resolvedStorage = resolveStorage(storage);

  function getProjects() {
    return sortNewestFirst(normalizeProjects(resolvedStorage.getStorageSync(STORAGE_KEY)));
  }

  function writeProjects(projects) {
    resolvedStorage.setStorageSync(STORAGE_KEY, sortNewestFirst(projects));
  }

  function saveProject(project) {
    const remaining = getProjects().filter((item) => item.id !== project.id);
    const nextProject = Object.assign(
      {
        favoriteStatus: false,
        compareStatus: false
      },
      project
    );
    writeProjects([nextProject].concat(remaining));
    return nextProject;
  }

  function updateProject(projectId, updater) {
    const projects = getProjects();
    const index = projects.findIndex((project) => project.id === projectId);

    if (index === -1) {
      return null;
    }

    const nextProject = updater(projects[index]);
    const nextProjects = projects.slice();
    nextProjects[index] = nextProject;
    writeProjects(nextProjects);
    return nextProject;
  }

  function toggleFavorite(projectId) {
    return updateProject(projectId, (project) =>
      Object.assign({}, project, { favoriteStatus: !project.favoriteStatus })
    );
  }

  function toggleCompare(projectId) {
    return updateProject(projectId, (project) =>
      Object.assign({}, project, { compareStatus: !project.compareStatus })
    );
  }

  return {
    getProjects,
    saveProject,
    toggleFavorite,
    toggleCompare
  };
}

module.exports = {
  STORAGE_KEY,
  createGeneratedProjectStore,
  createMemoryStorage
};
```

- [ ] **Step 5: Run tests and verify they pass**

Run:

```bash
pnpm test
```

Expected: PASS for 4 tests in `tests/generated-project-store.test.js`.

- [ ] **Step 6: Commit**

```bash
git add package.json lib/generated-project-store.js tests/generated-project-store.test.js
git commit -m "feat: add generated project store"
```

## Task 2: Add Mock Incubation Service

**Files:**
- Create: `lib/incubation-service.js`
- Create: `tests/incubation-service.test.js`

- [ ] **Step 1: Write failing incubation service tests**

Create `tests/incubation-service.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createIncubationSession,
  getCurrentQuestion,
  answerCurrentQuestion,
  canStartResearch,
  generateProjectResult
} = require("../lib/incubation-service");

test("createIncubationSession creates dynamic mobile-friendly questions", () => {
  const session = createIncubationSession("我想做一个帮自由职业者管理报价的工具");

  assert.equal(session.idea, "我想做一个帮自由职业者管理报价的工具");
  assert.equal(session.answers.length, 0);
  assert.ok(session.questions.length >= 4);
  assert.ok(session.questions.length <= 6);
  assert.equal(session.questions[0].allowCustomInput, true);
  assert.ok(session.questions[0].options.length >= 3);
});

test("answerCurrentQuestion records answers and advances", () => {
  const session = createIncubationSession("我想做一个 AI 选题工具");
  const currentQuestion = getCurrentQuestion(session);

  const nextSession = answerCurrentQuestion(session, {
    selectedOptions: [currentQuestion.options[0]],
    customInput: "先服务内容创作者"
  });

  assert.equal(nextSession.answers.length, 1);
  assert.equal(nextSession.answers[0].questionId, currentQuestion.questionId);
  assert.equal(nextSession.currentQuestionIndex, 1);
});

test("canStartResearch is true after all required questions are answered", () => {
  let session = createIncubationSession("我想做一个项目 PRD 生成工具");

  while (getCurrentQuestion(session)) {
    const question = getCurrentQuestion(session);
    session = answerCurrentQuestion(session, {
      selectedOptions: [question.options[0]],
      customInput: ""
    });
  }

  assert.equal(canStartResearch(session), true);
});

test("generateProjectResult returns the required structured result", () => {
  const session = createIncubationSession("我想做一个帮程序员快速生成 PRD 的工具");
  const result = generateProjectResult(session);

  assert.ok(result.id.startsWith("project-"));
  assert.equal(result.sourceIdea, session.idea);
  assert.ok(result.title.length > 0);
  assert.equal(result.domesticProducts.length, 3);
  assert.equal(result.globalProducts.length, 3);
  assert.ok(result.risks[0].description);
  assert.ok(result.risks[0].source);
  assert.equal(result.favoriteStatus, false);
  assert.equal(result.compareStatus, false);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm test
```

Expected: FAIL with `Cannot find module '../lib/incubation-service'`.

- [ ] **Step 3: Implement mock incubation service**

Create `lib/incubation-service.js`:

```js
function createQuestion(questionId, title, description, type, options) {
  return {
    questionId,
    title,
    description,
    type,
    options,
    allowCustomInput: true,
    isRequired: true
  };
}

function createQuestionsForIdea(idea) {
  const normalizedIdea = idea.trim();
  const isBusinessTool = /报价|客户|企业|SaaS|管理/.test(normalizedIdea);
  const isContentTool = /小红书|内容|选题|创作者/.test(normalizedIdea);

  const audienceOptions = isContentTool
    ? ["内容创作者", "自媒体团队", "品牌运营", "知识博主"]
    : ["个人开发者", "自由职业者", "小团队", "企业客户"];

  const platformOptions = isBusinessTool
    ? ["Web 工具", "SaaS", "微信小程序", "企业微信应用"]
    : ["微信小程序", "Web 工具", "浏览器插件", "AI Agent"];

  return [
    createQuestion(
      "target-user",
      "你最想先服务哪类用户？",
      "先锁定第一批用户，后面的竞品调研和切入建议才会更准确。",
      "single",
      audienceOptions
    ),
    createQuestion(
      "core-problem",
      "这个想法最想解决的核心问题是什么？",
      "请选出你最看重的痛点，也可以补充具体场景。",
      "multiple",
      ["节省时间", "降低成本", "提升转化", "减少重复劳动", "辅助决策"]
    ),
    createQuestion(
      "platform",
      "你更希望先做成哪种产品形态？",
      "产品形态会影响头部产品范围、开发成本和获客方式。",
      "single",
      platformOptions
    ),
    createQuestion(
      "resources",
      "你现在有哪些可用资源？",
      "AI 会根据资源判断更现实的切入优势。",
      "multiple",
      ["前端开发", "后端开发", "AI 应用开发", "设计能力", "运营渠道", "行业资源"]
    ),
    createQuestion(
      "business-model",
      "你更倾向哪种变现方式？",
      "变现方式会影响推荐切入方向和风险判断。",
      "single",
      ["订阅", "单次付费", "企业版", "服务交付", "暂不确定"]
    ),
    createQuestion(
      "risk",
      "哪些风险你最不能接受？",
      "AI 会在结果里标注风险和来源，避免只给乐观建议。",
      "multiple",
      ["开发周期长", "获客难", "竞品太强", "平台政策依赖", "付费意愿弱", "合规风险"]
    )
  ];
}

function createIncubationSession(idea) {
  return {
    idea: idea.trim(),
    questions: createQuestionsForIdea(idea),
    answers: [],
    currentQuestionIndex: 0
  };
}

function getCurrentQuestion(session) {
  return session.questions[session.currentQuestionIndex] || null;
}

function answerCurrentQuestion(session, answer) {
  const question = getCurrentQuestion(session);

  if (!question) {
    return session;
  }

  const nextAnswer = {
    questionId: question.questionId,
    questionTitle: question.title,
    selectedOptions: answer.selectedOptions || [],
    customInput: answer.customInput || ""
  };

  return Object.assign({}, session, {
    answers: session.answers.concat(nextAnswer),
    currentQuestionIndex: session.currentQuestionIndex + 1
  });
}

function goToPreviousQuestion(session) {
  if (session.currentQuestionIndex <= 0) {
    return session;
  }

  return Object.assign({}, session, {
    answers: session.answers.slice(0, -1),
    currentQuestionIndex: session.currentQuestionIndex - 1
  });
}

function canStartResearch(session) {
  return session.currentQuestionIndex >= session.questions.length;
}

function createProduct(name, positioning, strengths, weaknesses) {
  return {
    name,
    positioning,
    strengths,
    weaknesses
  };
}

function generateProjectResult(session) {
  const now = new Date().toISOString();
  const slug = String(Date.now());

  return {
    id: "project-" + slug,
    sourceIdea: session.idea,
    answers: session.answers,
    title: "AI 驱动的细分场景效率工具",
    conclusion: "建议做，但需要从明确人群和高频任务切入，避免一开始做成泛用平台。",
    domesticProducts: [
      createProduct("扣子", "AI Bot 与工作流搭建平台", "生态完善，上手快", "面向通用场景，细分行业深度不足"),
      createProduct("通义效率", "办公与内容生产 AI 工具", "模型能力强，品牌信任高", "独立开发者难以正面竞争"),
      createProduct("飞书多维表格", "团队协作与数据管理工具", "协作能力成熟，模板丰富", "轻量个人场景路径较重")
    ],
    globalProducts: [
      createProduct("Notion AI", "知识管理与 AI 写作助手", "用户基础大，工作流自然", "垂直项目决策深度有限"),
      createProduct("Airtable", "低代码数据与流程平台", "结构化能力强，生态丰富", "中文本地化和轻量用户门槛较高"),
      createProduct("Trello", "项目管理看板工具", "简单直观，适合轻协作", "AI 分析和商业判断能力弱")
    ],
    entryDirection: "先做一个聚焦单一人群的轻量决策助手，用 AI 把输入想法转成可验证的行动清单。",
    advantages: ["可以避开大平台的通用能力竞争", "小程序形态适合低门槛分享", "适合用内容渠道获取种子用户"],
    risks: [
      {
        description: "通用 AI 平台可能快速覆盖基础生成能力。",
        source: "国内外头部 AI 工作流产品都在扩展模板和插件生态。"
      },
      {
        description: "用户可能愿意试用，但不一定持续付费。",
        source: "效率工具常见风险是使用频次不足和付费意愿弱。"
      }
    ],
    suggestions: ["先做 1 个高频场景闭环", "访谈 5-10 个目标用户", "用落地页验证是否有人愿意留下联系方式"],
    createdAt: now,
    favoriteStatus: false,
    compareStatus: false
  };
}

module.exports = {
  createIncubationSession,
  getCurrentQuestion,
  answerCurrentQuestion,
  goToPreviousQuestion,
  canStartResearch,
  generateProjectResult
};
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
pnpm test
```

Expected: PASS for store and incubation service tests.

- [ ] **Step 5: Commit**

```bash
git add lib/incubation-service.js tests/incubation-service.test.js
git commit -m "feat: add mock incubation service"
```

## Task 3: Build Tab1 Initial Page

**Files:**
- Modify: `pages/find/index.json`
- Modify: `pages/find/index.js`
- Modify: `pages/find/index.wxml`
- Modify: `pages/find/index.wxss`

- [ ] **Step 1: Register Tab1 TDesign components**

Modify `pages/find/index.json`:

```json
{
  "navigationBarTitleText": "找项目",
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button",
    "t-textarea": "tdesign-miniprogram/textarea/textarea",
    "t-popup": "tdesign-miniprogram/popup/popup",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-tag": "tdesign-miniprogram/tag/tag",
    "t-loading": "tdesign-miniprogram/loading/loading",
    "t-empty": "tdesign-miniprogram/empty/empty",
    "t-divider": "tdesign-miniprogram/divider/divider",
    "t-toast": "tdesign-miniprogram/toast/toast"
  }
}
```

- [ ] **Step 2: Replace Tab1 page state with idea incubation state**

Modify `pages/find/index.js` initial data and imports:

```js
const {
  createIncubationSession,
  getCurrentQuestion,
  answerCurrentQuestion,
  goToPreviousQuestion,
  canStartResearch,
  generateProjectResult
} = require("../../lib/incubation-service");
const { createGeneratedProjectStore } = require("../../lib/generated-project-store");
const ToastModule = require("tdesign-miniprogram/toast/index");

const showToast = ToastModule.default || ToastModule.showToast || ToastModule;

const researchSteps = [
  "正在联网查询国内外优秀产品",
  "正在对比产品优劣",
  "正在分析产品方向"
];

function createResearchStepItems(activeStep, completedSteps) {
  return researchSteps.map((label, index) => {
    const done = completedSteps.indexOf(index) > -1;
    return {
      label,
      status: done ? "done" : activeStep === index ? "active" : "pending",
      mark: done ? "✓" : ""
    };
  });
}

Page({
  data: {
    ideaInput: "",
    examples: [
      "AI 帮我整理小红书选题",
      "给自由职业者做报价管理工具",
      "帮程序员快速生成项目 PRD",
      "面向本地商家的会员小程序"
    ],
    recentProjects: [],
    modalVisible: false,
    modalStage: "question",
    stageText: "正在补充关键信息",
    session: null,
    currentQuestion: null,
    selectedOptions: [],
    currentOptions: [],
    customInput: "",
    canStartResearch: false,
    researchSteps,
    activeResearchStep: 0,
    completedResearchSteps: [],
    researchStepItems: createResearchStepItems(0, []),
    generatedProject: null
  },

  onLoad() {
    this.projectStore = createGeneratedProjectStore();
    this.refreshRecentProjects();
  },

  onShow() {
    if (this.projectStore) {
      this.refreshRecentProjects();
    }
  },

  refreshRecentProjects() {
    const recentProjects = this.projectStore.getProjects().slice(0, 3);
    this.setData({ recentProjects });
  }
});
```

- [ ] **Step 3: Add initial page WXML**

Replace `pages/find/index.wxml` initial content with:

```xml
<view class="page find-page">
  <view class="hero">
    <view class="eyebrow">AI IDEA INCUBATION</view>
    <view class="title">灵感孵化</view>
    <view class="subtitle">输入一个项目想法，AI 会追问关键信息，并调研国内外产品，帮你找到可切入方向。</view>
  </view>

  <view class="idea-card">
    <t-textarea
      t-class="idea-input"
      value="{{ideaInput}}"
      placeholder="例如：我想做一个帮独立开发者找项目方向的小工具"
      maxlength="300"
      autosize="{{true}}"
      indicator="{{true}}"
      bind:change="onIdeaInput"
    />
    <t-button block theme="primary" size="large" disabled="{{!ideaInput}}" bind:tap="onStartIncubation">开始孵化</t-button>
  </view>

  <view class="section">
    <view class="section-title">示例灵感</view>
    <view class="example-grid">
      <t-tag wx:for="{{examples}}" wx:key="*this" class="example-chip" theme="primary" variant="light" size="large" data-value="{{item}}" bind:click="onUseExample">
        {{item}}
      </t-tag>
    </view>
  </view>

  <view class="section">
    <view class="section-title">最近孵化</view>
    <block wx:if="{{recentProjects.length}}">
      <view wx:for="{{recentProjects}}" wx:key="id" class="recent-card">
        <view class="recent-title">{{item.title}}</view>
        <view class="recent-text">{{item.conclusion}}</view>
        <view class="recent-meta">{{item.createdAt}}</view>
      </view>
    </block>
    <t-empty wx:else description="孵化完成的项目会保存到工作台。" />
  </view>

  <view class="ai-note">市场调研结果由 AI 生成，请结合真实数据进一步验证。</view>
</view>

<t-toast id="t-toast" />
```

- [ ] **Step 4: Add initial page handlers**

Add these methods inside `Page({ ... })` in `pages/find/index.js`:

```js
onIdeaInput(event) {
  this.setData({
    ideaInput: event.detail.value.trimStart()
  });
},

onUseExample(event) {
  this.setData({
    ideaInput: event.currentTarget.dataset.value
  });
},

onStartIncubation() {
  const idea = this.data.ideaInput.trim();

  if (!idea) {
    showToast({ context: this, selector: "#t-toast", message: "先输入一个项目想法", theme: "warning" });
    return;
  }

  const session = createIncubationSession(idea);
  this.setData({
    modalVisible: true,
    modalStage: "question",
    stageText: "正在补充关键信息",
    session,
    currentQuestion: getCurrentQuestion(session),
    selectedOptions: [],
    currentOptions: this.createOptionItems(getCurrentQuestion(session), []),
    customInput: "",
    canStartResearch: canStartResearch(session),
    activeResearchStep: 0,
    completedResearchSteps: [],
    generatedProject: null
  });
},

createOptionItems(question, selectedOptions) {
  if (!question) {
    return [];
  }

  return question.options.map((label) => ({
    label,
    selected: selectedOptions.indexOf(label) > -1
  }));
}
```

- [ ] **Step 5: Add initial page styles**

Create `pages/find/index.wxss` with:

```css
.find-page {
  padding-bottom: 96rpx;
}

.hero {
  margin-bottom: 30rpx;
}

.idea-card {
  padding: 28rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #ffffff;
}

.idea-input {
  margin-bottom: 24rpx;
}

.section {
  margin-top: 34rpx;
}

.section-title {
  margin-bottom: 16rpx;
  color: #111827;
  font-size: 30rpx;
  font-weight: 700;
}

.example-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.example-chip {
  min-height: 72rpx;
  padding: 14rpx;
  box-sizing: border-box;
  white-space: normal;
}

.recent-card {
  margin-top: 16rpx;
  padding: 22rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #ffffff;
}

.recent-title {
  color: #111827;
  font-size: 28rpx;
  font-weight: 700;
}

.recent-text,
.empty-line,
.ai-note {
  color: #6b7280;
  font-size: 24rpx;
  line-height: 1.6;
}

.recent-text {
  margin-top: 8rpx;
}

.recent-meta {
  margin-top: 10rpx;
  color: #9ca3af;
  font-size: 22rpx;
}

.ai-note {
  margin-top: 36rpx;
}
```

- [ ] **Step 6: Run logic tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 7: Manual visual check**

Open the project in WeChat Developer Tools and verify:

- Tab1 title is `灵感孵化`.
- Empty input disables the TDesign `开始孵化` button.
- Tapping a TDesign tag example fills the TDesign textarea.
- Entering text enables `开始孵化`.

- [ ] **Step 8: Commit**

```bash
git add pages/find/index.json pages/find/index.js pages/find/index.wxml pages/find/index.wxss
git commit -m "feat: build idea incubation landing"
```

## Task 4: Build Full-Screen AI Incubation Modal

**Files:**
- Modify: `pages/find/index.js`
- Modify: `pages/find/index.wxml`
- Modify: `pages/find/index.wxss`

- [ ] **Step 1: Add modal WXML after the Tab1 content**

Append this block before the final closing root of `pages/find/index.wxml` if needed, or place it as a sibling after the main page view:

```xml
<t-popup
  visible="{{modalVisible}}"
  placement="bottom"
  close-on-overlay-click="{{false}}"
  show-overlay="{{true}}"
  custom-style="height: 100vh;"
  t-class-content="incubation-modal"
  bind:visible-change="onModalVisibleChange"
>
  <view class="modal-header">
    <t-button shape="circle" theme="default" variant="text" bind:tap="onCloseModal">
      <t-icon name="close" size="40rpx" />
    </t-button>
    <view class="modal-title-wrap">
      <view class="modal-title">AI灵感孵化</view>
      <view class="modal-stage"><t-tag theme="primary" variant="light" size="small">AI</t-tag>{{stageText}}</view>
    </view>
    <view class="header-spacer"></view>
  </view>

  <scroll-view class="modal-body" scroll-y="true">
    <block wx:if="{{modalStage === 'question' && currentQuestion}}">
      <view class="question-card">
        <view class="question-title">{{currentQuestion.title}}</view>
        <view class="question-desc">{{currentQuestion.description}}</view>
        <view class="option-list">
          <t-tag
            wx:for="{{currentOptions}}"
            wx:key="label"
            class="option-item"
            theme="{{item.selected ? 'primary' : 'default'}}"
            variant="{{item.selected ? 'light' : 'outline'}}"
            size="large"
            data-value="{{item.label}}"
            bind:click="onToggleOption"
          >
            {{item.label}}
          </t-tag>
        </view>
        <t-textarea
          wx:if="{{currentQuestion.allowCustomInput}}"
          t-class="custom-input"
          value="{{customInput}}"
          placeholder="也可以补充你的具体情况"
          autosize="{{true}}"
          bind:change="onCustomInput"
        />
      </view>
    </block>

    <block wx:if="{{modalStage === 'research'}}">
      <view class="progress-card">
        <view wx:for="{{researchStepItems}}" wx:key="label" class="progress-row">
          <view class="progress-dot {{item.status}}">
            <t-icon wx:if="{{item.status === 'done'}}" name="check" size="28rpx" />
            <t-loading wx:if="{{item.status === 'active'}}" size="32rpx" theme="circular" />
          </view>
          <view class="progress-text">{{item.label}}</view>
        </view>
      </view>
    </block>

    <block wx:if="{{modalStage === 'result' && generatedProject}}">
      <view class="result-card">
        <view class="result-title">{{generatedProject.title}}</view>
        <view class="result-section">
          <view class="result-heading">方向结论</view>
          <view class="result-text">{{generatedProject.conclusion}}</view>
        </view>
        <view class="result-section">
          <view class="result-heading">国内产品</view>
          <view wx:for="{{generatedProject.domesticProducts}}" wx:key="name" class="product-row">
            <view class="product-name">{{item.name}}</view>
            <view class="product-text">{{item.positioning}}</view>
            <view class="product-text">优势：{{item.strengths}}</view>
            <view class="product-text">短板：{{item.weaknesses}}</view>
          </view>
        </view>
        <view class="result-section">
          <view class="result-heading">国外产品</view>
          <view wx:for="{{generatedProject.globalProducts}}" wx:key="name" class="product-row">
            <view class="product-name">{{item.name}}</view>
            <view class="product-text">{{item.positioning}}</view>
            <view class="product-text">优势：{{item.strengths}}</view>
            <view class="product-text">短板：{{item.weaknesses}}</view>
          </view>
        </view>
        <view class="result-section">
          <view class="result-heading">推荐切入方向和可切入优势</view>
          <view class="result-text">{{generatedProject.entryDirection}}</view>
          <view wx:for="{{generatedProject.advantages}}" wx:key="*this" class="bullet-line">{{item}}</view>
        </view>
        <view class="result-section">
          <view class="result-heading">风险</view>
          <view wx:for="{{generatedProject.risks}}" wx:key="description" class="risk-row">
            <view class="risk-desc">{{item.description}}</view>
            <view class="risk-source">来源：{{item.source}}</view>
          </view>
        </view>
        <view class="result-section">
          <view class="result-heading">建议</view>
          <view wx:for="{{generatedProject.suggestions}}" wx:key="*this" class="bullet-line">{{item}}</view>
        </view>
      </view>
    </block>
  </scroll-view>

  <view class="modal-actions">
    <block wx:if="{{modalStage === 'question'}}">
      <t-button class="secondary-button" theme="default" variant="outline" bind:tap="onPreviousQuestion">上一步</t-button>
      <t-button class="action-primary" theme="primary" bind:tap="onNextQuestion">
        {{canStartResearch ? '开始调研市场' : '下一步'}}
      </t-button>
    </block>
    <block wx:if="{{modalStage === 'result'}}">
      <t-button class="secondary-button" theme="default" variant="outline" bind:tap="onRegenerate">重新生成</t-button>
      <t-button class="secondary-button" theme="default" variant="outline" bind:tap="onModifyDirection">修改方向</t-button>
      <t-button class="action-primary" theme="primary" bind:tap="onConfirmDirection">确定方向</t-button>
    </block>
  </view>
</t-popup>
```

- [ ] **Step 2: Add modal handlers**

Add these methods to `pages/find/index.js`:

```js
onCloseModal() {
  this.setData({
    modalVisible: false
  });
},

onModalVisibleChange(event) {
  this.setData({
    modalVisible: event.detail.visible
  });
},

onToggleOption(event) {
  const value = event.currentTarget.dataset.value;
  const question = this.data.currentQuestion;
  const selectedOptions = this.data.selectedOptions.slice();
  const selectedIndex = selectedOptions.indexOf(value);

  if (question.type === "single") {
    this.setData({
      selectedOptions: [value],
      currentOptions: this.createOptionItems(question, [value])
    });
    return;
  }

  if (selectedIndex > -1) {
    selectedOptions.splice(selectedIndex, 1);
  } else {
    selectedOptions.push(value);
  }

  this.setData({
    selectedOptions,
    currentOptions: this.createOptionItems(question, selectedOptions)
  });
},

onCustomInput(event) {
  this.setData({
    customInput: event.detail.value
  });
},

onPreviousQuestion() {
  const previousSession = goToPreviousQuestion(this.data.session);
  this.setData({
    session: previousSession,
    currentQuestion: getCurrentQuestion(previousSession),
    selectedOptions: [],
    currentOptions: this.createOptionItems(getCurrentQuestion(previousSession), []),
    customInput: "",
    canStartResearch: canStartResearch(previousSession)
  });
},

onNextQuestion() {
  if (this.data.canStartResearch) {
    this.startResearchProgress();
    return;
  }

  if (!this.data.selectedOptions.length && !this.data.customInput.trim()) {
    showToast({ context: this, selector: "#t-toast", message: "请选择或补充一点信息", theme: "warning" });
    return;
  }

  const nextSession = answerCurrentQuestion(this.data.session, {
    selectedOptions: this.data.selectedOptions,
    customInput: this.data.customInput.trim()
  });

  this.setData({
    session: nextSession,
    currentQuestion: getCurrentQuestion(nextSession),
    selectedOptions: [],
    currentOptions: this.createOptionItems(getCurrentQuestion(nextSession), []),
    customInput: "",
    canStartResearch: canStartResearch(nextSession)
  });
},

startResearchProgress() {
  this.setData({
    modalStage: "research",
    stageText: "正在调研市场",
    activeResearchStep: 0,
    completedResearchSteps: [],
    researchStepItems: createResearchStepItems(0, [])
  });

  this.runResearchStep(0);
},

runResearchStep(stepIndex) {
  if (stepIndex >= this.data.researchSteps.length) {
    const generatedProject = generateProjectResult(this.data.session);
    this.setData({
      modalStage: "result",
      stageText: "已生成方向建议",
      generatedProject
    });
    return;
  }

  this.setData({
    activeResearchStep: stepIndex,
    researchStepItems: createResearchStepItems(stepIndex, this.data.completedResearchSteps)
  });

  setTimeout(() => {
    const completedResearchSteps = this.data.completedResearchSteps.concat(stepIndex);
    this.setData({
      completedResearchSteps,
      researchStepItems: createResearchStepItems(stepIndex, completedResearchSteps)
    });
    this.runResearchStep(stepIndex + 1);
  }, 650);
},

onRegenerate() {
  this.startResearchProgress();
},

onModifyDirection() {
  this.setData({
    modalStage: "question",
    stageText: "正在补充关键信息",
    currentQuestion: getCurrentQuestion(this.data.session),
    selectedOptions: [],
    currentOptions: this.createOptionItems(getCurrentQuestion(this.data.session), []),
    customInput: "",
    generatedProject: null
  });
},

onConfirmDirection() {
  const project = this.projectStore.saveProject(this.data.generatedProject);
  this.setData({
    modalVisible: false,
    generatedProject: null
  });
  wx.switchTab({
    url: "/pages/workspace/index",
    success: () => {
      this.refreshRecentProjects();
    },
    fail: () => {
      showToast({ context: this, selector: "#t-toast", message: "已保存，可到工作台查看", theme: "success" });
      this.refreshRecentProjects();
    }
  });
}
```

- [ ] **Step 3: Add modal styles**

Append to `pages/find/index.wxss`:

```css
.incubation-modal {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: #f6f7f9;
  animation: slideUp 180ms ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.modal-header {
  display: grid;
  grid-template-columns: 88rpx 1fr 88rpx;
  align-items: center;
  padding: 28rpx 24rpx 20rpx;
  border-bottom: 1rpx solid #e5e7eb;
  background: #ffffff;
}

.icon-button {
  width: 64rpx;
  height: 64rpx;
  padding: 0;
  border-radius: 50%;
  background: #f3f4f6;
  color: #111827;
  font-size: 36rpx;
  line-height: 64rpx;
}

.modal-title-wrap {
  text-align: center;
}

.modal-title {
  color: #111827;
  font-size: 32rpx;
  font-weight: 800;
}

.modal-stage {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
  color: #0f766e;
  font-size: 24rpx;
}

.ai-icon {
  padding: 2rpx 8rpx;
  border-radius: 8rpx;
  background: #ccfbf1;
  color: #0f766e;
  font-size: 20rpx;
  font-weight: 800;
}

.modal-body {
  flex: 1;
  min-height: 0;
  padding: 28rpx;
  box-sizing: border-box;
}

.question-card,
.progress-card,
.result-card {
  padding: 28rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #ffffff;
}

.question-title,
.result-title {
  color: #111827;
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1.35;
}

.question-desc {
  margin-top: 12rpx;
  color: #6b7280;
  font-size: 26rpx;
  line-height: 1.6;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 26rpx;
}

.option-item {
  padding: 22rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  background: #ffffff;
  color: #374151;
  font-size: 27rpx;
  line-height: 1.4;
}

.option-item.selected {
  border-color: #0f766e;
  background: #ecfdf5;
  color: #047857;
  font-weight: 700;
}

.custom-input {
  width: 100%;
  min-height: 140rpx;
  margin-top: 24rpx;
  padding: 18rpx;
  box-sizing: border-box;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  background: #f9fafb;
  color: #111827;
  font-size: 26rpx;
  line-height: 1.6;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx 0;
}

.progress-dot {
  width: 42rpx;
  height: 42rpx;
  border: 2rpx solid #d1d5db;
  border-radius: 50%;
  color: #ffffff;
  text-align: center;
  font-size: 24rpx;
  line-height: 42rpx;
}

.progress-dot.active {
  border-color: #0f766e;
  background: #ccfbf1;
}

.progress-dot.done {
  border-color: #0f766e;
  background: #0f766e;
}

.progress-text {
  color: #111827;
  font-size: 28rpx;
  font-weight: 700;
}

.result-section {
  margin-top: 28rpx;
}

.result-heading {
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
}

.result-text,
.product-text,
.bullet-line,
.risk-desc,
.risk-source {
  margin-top: 10rpx;
  color: #4b5563;
  font-size: 25rpx;
  line-height: 1.6;
}

.product-row,
.risk-row {
  margin-top: 14rpx;
  padding: 18rpx;
  border-radius: 12rpx;
  background: #f9fafb;
}

.product-name {
  color: #111827;
  font-size: 27rpx;
  font-weight: 800;
}

.risk-source {
  color: #9a3412;
}

.modal-actions {
  display: flex;
  gap: 16rpx;
  padding: 18rpx 24rpx 34rpx;
  border-top: 1rpx solid #e5e7eb;
  background: #ffffff;
}

.secondary-button {
  flex: 1;
  height: 84rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
  color: #374151;
  font-size: 26rpx;
  line-height: 84rpx;
}

.action-primary {
  flex: 1.4;
  margin-top: 0;
}
```

- [ ] **Step 4: Run logic tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 5: Manual interaction check**

Open in WeChat Developer Tools and verify:

- `开始孵化` opens a full-screen modal from the bottom.
- Header title is `AI灵感孵化`.
- Stage text starts as `正在补充关键信息`.
- Single-choice questions select one option.
- Multiple-choice questions toggle multiple options.
- `下一步` advances through questions.
- Final question changes the primary action to `开始调研市场`.
- Research screen shows three progress rows and checks them one by one.
- Result screen displays all required sections.
- `重新生成` returns to progress then result.
- `修改方向` returns to question state.

- [ ] **Step 6: Commit**

```bash
git add pages/find/index.js pages/find/index.wxml pages/find/index.wxss
git commit -m "feat: add AI incubation modal"
```

## Task 5: Build Workspace Generated Project List

**Files:**
- Modify: `pages/workspace/index.json`
- Modify: `pages/workspace/index.js`
- Modify: `pages/workspace/index.wxml`
- Modify: `pages/workspace/index.wxss`

- [ ] **Step 1: Register workspace TDesign components**

Modify `pages/workspace/index.json`:

```json
{
  "navigationBarTitleText": "工作台",
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button",
    "t-popup": "tdesign-miniprogram/popup/popup",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-tag": "tdesign-miniprogram/tag/tag",
    "t-empty": "tdesign-miniprogram/empty/empty",
    "t-toast": "tdesign-miniprogram/toast/toast"
  }
}
```

- [ ] **Step 2: Replace workspace state and handlers**

Modify `pages/workspace/index.js`:

```js
const { createGeneratedProjectStore } = require("../../lib/generated-project-store");
const ToastModule = require("tdesign-miniprogram/toast/index");

const showToast = ToastModule.default || ToastModule.showToast || ToastModule;

Page({
  data: {
    projects: [],
    selectedProject: null,
    detailVisible: false
  },

  onLoad() {
    this.projectStore = createGeneratedProjectStore();
    this.refreshProjects();
  },

  onShow() {
    if (this.projectStore) {
      this.refreshProjects();
    }
  },

  refreshProjects() {
    this.setData({
      projects: this.projectStore.getProjects()
    });
  },

  onToggleFavorite(event) {
    const project = this.projectStore.toggleFavorite(event.currentTarget.dataset.id);
    if (project) {
      this.refreshProjects();
    }
  },

  onToggleCompare(event) {
    const project = this.projectStore.toggleCompare(event.currentTarget.dataset.id);
    if (project) {
      this.refreshProjects();
    }
  },

  onGeneratePrd() {
    showToast({ context: this, selector: "#t-toast", message: "PRD 生成功能后续接入", theme: "warning" });
  },

  onOpenDetail(event) {
    const projectId = event.currentTarget.dataset.id;
    const selectedProject = this.data.projects.find((project) => project.id === projectId);

    this.setData({
      selectedProject,
      detailVisible: Boolean(selectedProject)
    });
  },

  onCloseDetail() {
    this.setData({
      selectedProject: null,
      detailVisible: false
    });
  },

  onDetailVisibleChange(event) {
    this.setData({
      detailVisible: event.detail.visible
    });
  }
});
```

- [ ] **Step 3: Replace workspace WXML**

Modify `pages/workspace/index.wxml`:

```xml
<view class="page workspace-page">
  <view class="eyebrow">WORKSPACE</view>
  <view class="title">已生成项目</view>
  <view class="subtitle">这里承接从灵感孵化确定的项目方向，你可以收藏、加入对比或继续生成 PRD。</view>

  <block wx:if="{{projects.length}}">
    <view wx:for="{{projects}}" wx:key="id" class="project-card" data-id="{{item.id}}" bindtap="onOpenDetail">
      <view class="project-header">
        <view class="project-title">{{item.title}}</view>
        <t-tag theme="warning" variant="light">{{item.risks.length}} 个风险</t-tag>
      </view>
      <view class="project-text">{{item.conclusion}}</view>
      <view class="project-text">{{item.entryDirection}}</view>
      <view class="project-meta">{{item.createdAt}}</view>
      <view class="project-actions" catchtap="noop">
        <t-button size="small" theme="{{item.favoriteStatus ? 'primary' : 'default'}}" variant="{{item.favoriteStatus ? 'base' : 'outline'}}" data-id="{{item.id}}" catch:tap="onToggleFavorite">
          {{item.favoriteStatus ? '已收藏' : '收藏'}}
        </t-button>
        <t-button size="small" theme="{{item.compareStatus ? 'primary' : 'default'}}" variant="{{item.compareStatus ? 'base' : 'outline'}}" data-id="{{item.id}}" catch:tap="onToggleCompare">
          {{item.compareStatus ? '已对比' : '对比'}}
        </t-button>
        <t-button size="small" theme="primary" catch:tap="onGeneratePrd">生成PRD</t-button>
      </view>
    </view>
  </block>

  <t-empty wx:else description="去「找项目」输入一个项目想法，AI 会帮你孵化方向并保存到这里。" />
</view>

<t-toast id="t-toast" />

<t-popup
  wx:if="{{selectedProject}}"
  visible="{{detailVisible}}"
  placement="bottom"
  close-on-overlay-click="{{false}}"
  custom-style="height: 100vh;"
  t-class-content="detail-modal"
  bind:visible-change="onDetailVisibleChange"
>
  <view class="detail-header">
    <t-button shape="circle" theme="default" variant="text" bind:tap="onCloseDetail">
      <t-icon name="close" size="40rpx" />
    </t-button>
    <view class="detail-title">项目详情</view>
    <view class="header-spacer"></view>
  </view>
  <scroll-view class="detail-body" scroll-y="true">
    <view class="detail-card">
      <view class="project-title">{{selectedProject.title}}</view>
      <view class="detail-section">
        <view class="detail-heading">方向结论</view>
        <view class="detail-text">{{selectedProject.conclusion}}</view>
      </view>
      <view class="detail-section">
        <view class="detail-heading">国内产品</view>
        <view wx:for="{{selectedProject.domesticProducts}}" wx:key="name" class="product-row">
          <view class="product-name">{{item.name}}</view>
          <view class="product-text">{{item.positioning}}</view>
          <view class="product-text">优势：{{item.strengths}}</view>
          <view class="product-text">短板：{{item.weaknesses}}</view>
        </view>
      </view>
      <view class="detail-section">
        <view class="detail-heading">国外产品</view>
        <view wx:for="{{selectedProject.globalProducts}}" wx:key="name" class="product-row">
          <view class="product-name">{{item.name}}</view>
          <view class="product-text">{{item.positioning}}</view>
          <view class="product-text">优势：{{item.strengths}}</view>
          <view class="product-text">短板：{{item.weaknesses}}</view>
        </view>
      </view>
      <view class="detail-section">
        <view class="detail-heading">推荐切入方向和可切入优势</view>
        <view class="detail-text">{{selectedProject.entryDirection}}</view>
        <view wx:for="{{selectedProject.advantages}}" wx:key="*this" class="bullet-line">{{item}}</view>
      </view>
      <view class="detail-section">
        <view class="detail-heading">风险</view>
        <view wx:for="{{selectedProject.risks}}" wx:key="description" class="risk-row">
          <view class="risk-desc">{{item.description}}</view>
          <view class="risk-source">来源：{{item.source}}</view>
        </view>
      </view>
      <view class="detail-section">
        <view class="detail-heading">建议</view>
        <view wx:for="{{selectedProject.suggestions}}" wx:key="*this" class="bullet-line">{{item}}</view>
      </view>
    </view>
  </scroll-view>
</t-popup>
```

- [ ] **Step 4: Add missing no-op handler**

Add this method in `pages/workspace/index.js` to support the WXML action row:

```js
noop() {}
```

- [ ] **Step 5: Add workspace styles**

Create `pages/workspace/index.wxss`:

```css
.workspace-page {
  padding-bottom: 96rpx;
}

.project-card,
.empty-workspace {
  margin-top: 28rpx;
  padding: 26rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #ffffff;
}

.project-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.project-title,
.empty-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.35;
}

.project-text,
.detail-text,
.product-text,
.bullet-line,
.risk-desc,
.risk-source {
  margin-top: 10rpx;
  color: #4b5563;
  font-size: 25rpx;
  line-height: 1.6;
}

.project-meta {
  margin-top: 12rpx;
  color: #9ca3af;
  font-size: 22rpx;
}

.project-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 20rpx;
}

.detail-modal {
  z-index: 20;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f6f7f9;
}

.detail-header {
  display: grid;
  grid-template-columns: 88rpx 1fr 88rpx;
  align-items: center;
  padding: 28rpx 24rpx 20rpx;
  border-bottom: 1rpx solid #e5e7eb;
  background: #ffffff;
}

.detail-title {
  color: #111827;
  text-align: center;
  font-size: 32rpx;
  font-weight: 800;
}

.detail-body {
  flex: 1;
  min-height: 0;
  padding: 28rpx;
  box-sizing: border-box;
}

.detail-card {
  padding: 28rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #ffffff;
}

.detail-section {
  margin-top: 28rpx;
}

.detail-heading {
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
}

.product-row,
.risk-row {
  margin-top: 14rpx;
  padding: 18rpx;
  border-radius: 12rpx;
  background: #f9fafb;
}

.product-name {
  color: #111827;
  font-size: 27rpx;
  font-weight: 800;
}

.risk-source {
  color: #9a3412;
}
```

- [ ] **Step 6: Run logic tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 7: Manual workspace check**

In WeChat Developer Tools:

- Complete a Tab1 generated result and tap `确定方向`.
- Verify the app switches to `工作台`.
- Verify the saved project appears in the project list.
- Tap `收藏`; label changes to `已收藏`.
- Tap `对比`; label changes to `已对比`.
- Tap `生成PRD`; toast appears.
- Tap the project card; detail modal opens with all result sections.
- Close the detail modal.

- [ ] **Step 8: Commit**

```bash
git add pages/workspace/index.json pages/workspace/index.js pages/workspace/index.wxml pages/workspace/index.wxss
git commit -m "feat: show generated projects in workspace"
```

## Task 6: Final Verification and Polish

**Files:**
- Inspect: `pages/find/index.js`
- Inspect: `pages/find/index.wxml`
- Modify only if overflow appears: `pages/find/index.wxss`
- Inspect: `pages/workspace/index.js`
- Inspect: `pages/workspace/index.wxml`
- Modify only if overflow appears: `pages/workspace/index.wxss`

- [ ] **Step 1: Run all automated tests**

Run:

```bash
pnpm test
```

Expected: PASS for all tests.

- [ ] **Step 2: Check formatting-sensitive files**

Run:

```bash
pnpm exec prettier --check "lib/**/*.js" "tests/**/*.js" "pages/**/*.js"
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 3: Run final manual product flow**

In WeChat Developer Tools, verify this full flow:

1. Open Tab1.
2. Tap an example idea.
3. Tap `开始孵化`.
4. Answer all AI questions.
5. Tap `开始调研市场`.
6. Watch all three progress items turn checked.
7. Confirm the result shows direction conclusion, domestic products, global products, entry direction and advantages, risks with sources, and suggestions.
8. Tap `确定方向`.
9. Confirm workspace opens and shows the generated project.
10. Open project detail and verify the same structured analysis appears.

- [ ] **Step 4: Fix any UI text overflow**

If any button label or table text overflows in the WeChat simulator, adjust only the affected class. Use this pattern for button text:

```css
.secondary-button,
.action-primary,
.project-actions t-button {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Use this pattern for long report content:

```css
.product-text,
.risk-desc,
.risk-source,
.detail-text,
.result-text {
  word-break: break-word;
}
```

- [ ] **Step 5: Confirm git state**

Run:

```bash
git status --short
```

Expected: no output if all changes were committed, or only intentional final polish files before the final commit.

- [ ] **Step 6: Commit final polish if needed**

If Step 4 changed files, commit them:

```bash
git add pages/find/index.wxss pages/workspace/index.wxss
git commit -m "polish: refine incubation UI overflow"
```

## Self-Review

- Spec coverage: covered Tab1 initial page, full-screen bottom-up modal, dynamic model-generated questions through a service boundary, `开始调研市场`, three-step progress, structured result sections, risk sources, and workspace handoff.
- Component coverage: plan registers and uses TDesign components for textareas, buttons, popup modals, tags, loading indicators, empty states, icons, and toast messages; custom CSS remains only for product-specific layout and report composition.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: `GeneratedProject`, `IncubationAnswer`, `ProductResearchItem`, and `RiskItem` property names match the design spec and are used consistently in Tab1 and workspace.
