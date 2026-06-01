const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const {
  createIncubationSession,
  getCurrentQuestion,
  answerCurrentQuestion,
} = require("../lib/incubation-service");

function loadFindPageConfig() {
  const pagePath = require.resolve("../pages/find/index.js");
  const originalPage = global.Page;
  const originalLoad = Module._load;
  let pageConfig = null;

  delete require.cache[pagePath];
  global.Page = (config) => {
    pageConfig = config;
  };
  Module._load = function load(request, parent, isMain) {
    if (request === "tdesign-miniprogram/toast/index") {
      return function showToast() {};
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    require(pagePath);
  } finally {
    global.Page = originalPage;
    Module._load = originalLoad;
  }

  return pageConfig;
}

function createPageInstance() {
  const pageConfig = loadFindPageConfig();

  return Object.assign({}, pageConfig, {
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(nextData) {
      Object.assign(this.data, nextData);
    },
  });
}

test("onPreviousQuestion restores the answer UI for the returned question", () => {
  const page = createPageInstance();

  page.setData({ ideaInput: "我想做一个 AI 选题工具" });
  page.onStartIncubation();

  const firstQuestion = page.data.currentQuestion;
  page.setData({
    selectedOptions: [firstQuestion.options[0]],
    customInput: "先服务内容创作者",
  });
  page.onNextQuestion();

  const secondQuestion = page.data.currentQuestion;
  page.setData({
    selectedOptions: [secondQuestion.options[0]],
    customInput: "减少重复劳动",
  });
  page.onNextQuestion();

  page.onPreviousQuestion();

  assert.equal(page.data.currentQuestion.questionId, secondQuestion.questionId);
  assert.deepEqual(page.data.selectedOptions, [secondQuestion.options[0]]);
  assert.equal(page.data.customInput, "减少重复劳动");
  assert.equal(
    page.data.currentOptions.find(
      (option) => option.label === secondQuestion.options[0],
    ).selected,
    true,
  );
});

test("modal idea edits rebuild the incubation session from the first question", () => {
  const page = createPageInstance();
  const originalIdea = "我想做一个项目 PRD 生成工具";
  const nextIdea = "我想做一个小红书选题工具";
  let session = createIncubationSession(originalIdea);

  while (getCurrentQuestion(session)) {
    const question = getCurrentQuestion(session);
    session = answerCurrentQuestion(session, {
      selectedOptions: [question.options[0]],
      customInput: "",
    });
  }

  page.setData({
    ideaInput: originalIdea,
    session,
    modalStage: "result",
    generatedProject: { title: "旧方向" },
  });

  page.onModifyDirection();
  page.onModalIdeaInput({ detail: { value: nextIdea } });

  assert.equal(page.data.ideaInput, nextIdea);
  assert.equal(page.data.session.idea, nextIdea);
  assert.equal(page.data.session.currentQuestionIndex, 0);
  assert.deepEqual(page.data.session.answers, []);
  assert.equal(page.data.currentQuestion.questionId, "target-user");
  assert.ok(
    page.data.currentOptions.some((option) => option.label === "内容创作者"),
  );
});
