const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createIncubationSession,
  getCurrentQuestion,
  answerCurrentQuestion,
  goToPreviousQuestion,
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

test("answerCurrentQuestion leaves the original session unchanged", () => {
  const session = createIncubationSession("我想做一个 AI 选题工具");
  const currentQuestion = getCurrentQuestion(session);

  answerCurrentQuestion(session, {
    selectedOptions: [currentQuestion.options[0]],
    customInput: "先服务内容创作者"
  });

  assert.equal(session.answers.length, 0);
  assert.equal(session.currentQuestionIndex, 0);
});

test("answerCurrentQuestion copies selected options from caller input", () => {
  const session = createIncubationSession("我想做一个 AI 选题工具");
  const currentQuestion = getCurrentQuestion(session);
  const selectedOptions = [currentQuestion.options[0]];

  const nextSession = answerCurrentQuestion(session, {
    selectedOptions,
    customInput: "先服务内容创作者"
  });
  selectedOptions.push("后来追加的选项");

  assert.deepEqual(nextSession.answers[0].selectedOptions, [currentQuestion.options[0]]);
});

test("answerCurrentQuestion copies existing answers into the next session", () => {
  let session = createIncubationSession("我想做一个 AI 选题工具");
  const firstQuestion = getCurrentQuestion(session);
  session = answerCurrentQuestion(session, {
    selectedOptions: [firstQuestion.options[0]],
    customInput: "先服务内容创作者"
  });
  const secondQuestion = getCurrentQuestion(session);

  const nextSession = answerCurrentQuestion(session, {
    selectedOptions: [secondQuestion.options[0]],
    customInput: "减少重复劳动"
  });
  session.answers[0].selectedOptions.push("后来修改的旧选项");
  session.answers[0].customInput = "后来修改的旧输入";

  assert.deepEqual(nextSession.answers[0].selectedOptions, [firstQuestion.options[0]]);
  assert.equal(nextSession.answers[0].customInput, "先服务内容创作者");
});

test("answerCurrentQuestion copies questions into the next session", () => {
  const session = createIncubationSession("我想做一个 AI 选题工具");
  const firstQuestion = getCurrentQuestion(session);

  const nextSession = answerCurrentQuestion(session, {
    selectedOptions: [firstQuestion.options[0]],
    customInput: "先服务内容创作者"
  });
  nextSession.questions[0].options.push("后来修改的问题选项");

  assert.equal(session.questions[0].options.includes("后来修改的问题选项"), false);
});

test("goToPreviousQuestion removes the last answer and moves index back", () => {
  let session = createIncubationSession("我想做一个项目 PRD 生成工具");
  const firstQuestion = getCurrentQuestion(session);

  session = answerCurrentQuestion(session, {
    selectedOptions: [firstQuestion.options[0]],
    customInput: ""
  });
  const previousSession = goToPreviousQuestion(session);

  assert.equal(previousSession.answers.length, 0);
  assert.equal(previousSession.currentQuestionIndex, 0);
});

test("goToPreviousQuestion copies remaining answers", () => {
  let session = createIncubationSession("我想做一个项目 PRD 生成工具");
  const firstQuestion = getCurrentQuestion(session);
  session = answerCurrentQuestion(session, {
    selectedOptions: [firstQuestion.options[0]],
    customInput: "先服务小团队"
  });
  const secondQuestion = getCurrentQuestion(session);
  session = answerCurrentQuestion(session, {
    selectedOptions: [secondQuestion.options[0]],
    customInput: "提升转化"
  });

  const previousSession = goToPreviousQuestion(session);
  previousSession.answers[0].selectedOptions.push("后来修改的返回选项");
  previousSession.answers[0].customInput = "后来修改的返回输入";

  assert.deepEqual(session.answers[0].selectedOptions, [firstQuestion.options[0]]);
  assert.equal(session.answers[0].customInput, "先服务小团队");
});

test("goToPreviousQuestion copies questions into the previous session", () => {
  let session = createIncubationSession("我想做一个项目 PRD 生成工具");
  const firstQuestion = getCurrentQuestion(session);
  session = answerCurrentQuestion(session, {
    selectedOptions: [firstQuestion.options[0]],
    customInput: "先服务小团队"
  });
  const secondQuestion = getCurrentQuestion(session);
  session = answerCurrentQuestion(session, {
    selectedOptions: [secondQuestion.options[0]],
    customInput: "提升转化"
  });

  const previousSession = goToPreviousQuestion(session);
  previousSession.questions[0].options.push("后来修改的问题选项");

  assert.equal(session.questions[0].options.includes("后来修改的问题选项"), false);
});

test("getCurrentQuestion returns a copy of the stored question", () => {
  const session = createIncubationSession("我想做一个 AI 选题工具");
  const currentQuestion = getCurrentQuestion(session);

  currentQuestion.options.push("后来追加的选项");
  currentQuestion.title = "后来修改的标题";

  assert.notEqual(session.questions[0].title, "后来修改的标题");
  assert.equal(session.questions[0].options.includes("后来追加的选项"), false);
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

test("generateProjectResult copies session answers", () => {
  let session = createIncubationSession("我想做一个帮程序员快速生成 PRD 的工具");
  const question = getCurrentQuestion(session);
  session = answerCurrentQuestion(session, {
    selectedOptions: [question.options[0]],
    customInput: "先服务小团队"
  });

  const result = generateProjectResult(session);
  session.answers[0].selectedOptions.push("后来修改的选项");
  session.answers.push({
    questionId: "later",
    questionTitle: "later",
    selectedOptions: ["later"],
    customInput: "later"
  });

  assert.equal(result.answers.length, 1);
  assert.deepEqual(result.answers[0].selectedOptions, [question.options[0]]);
});

test("generateProjectResult creates distinct ids for rapid calls", () => {
  const session = createIncubationSession("我想做一个帮程序员快速生成 PRD 的工具");
  const firstResult = generateProjectResult(session);
  const secondResult = generateProjectResult(session);

  assert.notEqual(firstResult.id, secondResult.id);
});

test("createIncubationSession tolerates non-string input", () => {
  const nullSession = createIncubationSession(null);
  const undefinedSession = createIncubationSession();

  assert.equal(nullSession.idea, "");
  assert.equal(undefinedSession.idea, "");
});
