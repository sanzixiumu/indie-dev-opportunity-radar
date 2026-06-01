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
