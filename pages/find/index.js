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
  },

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
    const currentQuestion = getCurrentQuestion(session);

    this.setData({
      modalVisible: true,
      modalStage: "question",
      stageText: "正在补充关键信息",
      session,
      currentQuestion,
      selectedOptions: [],
      currentOptions: this.createOptionItems(currentQuestion, []),
      customInput: "",
      canStartResearch: canStartResearch(session),
      activeResearchStep: 0,
      completedResearchSteps: [],
      researchStepItems: createResearchStepItems(0, []),
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
});
