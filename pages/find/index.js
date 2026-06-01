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

function hasAnswer(selectedOptions, customInput) {
  return selectedOptions.length > 0 || Boolean(customInput.trim());
}

function isLastQuestion(session) {
  return Boolean(session) && session.currentQuestionIndex === session.questions.length - 1;
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
    isLastQuestion: false,
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
      isLastQuestion: isLastQuestion(session),
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
  },

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

    if (!question) {
      return;
    }

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
    const currentQuestion = getCurrentQuestion(previousSession);

    this.setData({
      session: previousSession,
      currentQuestion,
      selectedOptions: [],
      currentOptions: this.createOptionItems(currentQuestion, []),
      customInput: "",
      canStartResearch: canStartResearch(previousSession),
      isLastQuestion: isLastQuestion(previousSession)
    });
  },

  onNextQuestion() {
    if (!hasAnswer(this.data.selectedOptions, this.data.customInput)) {
      showToast({ context: this, selector: "#t-toast", message: "请选择或补充一点信息", theme: "warning" });
      return;
    }

    const answeredLastQuestion = this.data.isLastQuestion;
    const nextSession = answerCurrentQuestion(this.data.session, {
      selectedOptions: this.data.selectedOptions,
      customInput: this.data.customInput.trim()
    });

    if (answeredLastQuestion) {
      this.setData({
        session: nextSession,
        selectedOptions: [],
        customInput: "",
        canStartResearch: true,
        isLastQuestion: false
      });
      this.startResearchProgress();
      return;
    }

    const nextQuestion = getCurrentQuestion(nextSession);

    this.setData({
      session: nextSession,
      currentQuestion: nextQuestion,
      selectedOptions: [],
      currentOptions: this.createOptionItems(nextQuestion, []),
      customInput: "",
      canStartResearch: canStartResearch(nextSession),
      isLastQuestion: isLastQuestion(nextSession)
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
    const editableSession = canStartResearch(this.data.session)
      ? goToPreviousQuestion(this.data.session)
      : this.data.session;
    const currentQuestion = getCurrentQuestion(editableSession);

    this.setData({
      session: editableSession,
      modalStage: "question",
      stageText: "正在补充关键信息",
      currentQuestion,
      selectedOptions: [],
      currentOptions: this.createOptionItems(currentQuestion, []),
      customInput: "",
      canStartResearch: canStartResearch(editableSession),
      isLastQuestion: isLastQuestion(editableSession),
      generatedProject: null
    });
  },

  onConfirmDirection() {
    this.projectStore.saveProject(this.data.generatedProject);
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
});
