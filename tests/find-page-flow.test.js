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

test("modal idea edits clear cloud generated questions and result", () => {
  const page = createPageInstance();

  page.client = {
    async call() {
      throw new Error("not used");
    },
  };
  page.setData({
    ideaInput: "我想做一个项目 PRD 生成工具",
    session: null,
    stage: "result",
    questions: [
      {
        questionId: "q_old",
        title: "旧问题",
        options: [{ label: "旧选项", value: "old" }],
      },
    ],
    answers: [
      {
        questionId: "q_old",
        questionTitle: "旧问题",
        selectedOptions: ["old"],
        customInput: "",
      },
    ],
    projectResult: { title: "旧方向" },
  });

  page.onModalIdeaInput({ detail: { value: "我想做一个小红书选题工具" } });

  assert.equal(page.data.ideaInput, "我想做一个小红书选题工具");
  assert.equal(page.data.stage, "questioning");
  assert.deepEqual(page.data.questions, []);
  assert.deepEqual(page.data.answers, []);
  assert.equal(page.data.projectResult, null);
});

test("regenerating questions after a cloud idea edit uses the edited idea", async () => {
  const page = createPageInstance();
  const calls = [];

  page.client = {
    async call(name, payload) {
      calls.push({ name, payload });
      return {
        questions: [
          {
            questionId: "q_new",
            title: "新问题",
            description: "新描述",
            options: [{ label: "新选项", value: "new" }],
          },
        ],
      };
    },
  };
  page.setData({
    modalVisible: true,
    ideaInput: "我想做一个项目 PRD 生成工具",
    session: null,
    stage: "questioning",
    questions: [
      {
        questionId: "q_old",
        title: "旧问题",
        options: [{ label: "旧选项", value: "old" }],
      },
    ],
  });

  page.onModalIdeaInput({ detail: { value: "我想做一个小红书选题工具" } });

  assert.deepEqual(page.data.questions, []);

  await page.onRegenerateQuestions();

  assert.deepEqual(calls, [
    {
      name: "createIncubationQuestions",
      payload: { idea: "我想做一个小红书选题工具" },
    },
  ]);
  assert.equal(page.data.stage, "questioning");
  assert.equal(page.data.questions[0].questionId, "q_new");
});

test("regenerating questions with a blank idea does not call the backend", async () => {
  const page = createPageInstance();
  let callCount = 0;

  page.client = {
    async call() {
      callCount += 1;
      return { questions: [] };
    },
  };
  page.setData({
    modalVisible: true,
    ideaInput: "",
    session: null,
    stage: "questioning",
    questions: [],
  });

  await page.onRegenerateQuestions();

  assert.equal(callCount, 0);
});
