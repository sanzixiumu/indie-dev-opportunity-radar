const {
  createIncubationSession,
  getCurrentQuestion,
  answerCurrentQuestion,
  goToPreviousQuestion,
  canStartResearch,
  generateProjectResult,
} = require("../../lib/incubation-service");
const {
  createGeneratedProjectStore,
} = require("../../lib/generated-project-store");
const { withFormattedCreatedAt } = require("../../lib/display-format");
const ToastModule = require("tdesign-miniprogram/toast/index");

const showToast = ToastModule.default || ToastModule.showToast || ToastModule;

const researchSteps = [
  "正在联网查询国内外优秀产品",
  "正在对比产品优劣",
  "正在分析产品方向",
];

function createResearchStepItems(activeStep, completedSteps) {
  return researchSteps.map((label, index) => {
    const done = completedSteps.indexOf(index) > -1;
    return {
      label,
      status: done ? "done" : activeStep === index ? "active" : "pending",
      mark: done ? "✓" : "",
    };
  });
}

function hasAnswer(selectedOptions, customInput) {
  return selectedOptions.length > 0 || Boolean(customInput.trim());
}

function isLastQuestion(session) {
  return (
    Boolean(session) &&
    session.currentQuestionIndex === session.questions.length - 1
  );
}

function canGoPrevious(session) {
  return Boolean(session) && session.currentQuestionIndex > 0;
}

function createOptionItems(question, selectedOptions) {
  if (!question) {
    return [];
  }

  return question.options.map((label) => ({
    label,
    selected: selectedOptions.indexOf(label) > -1,
  }));
}

function createQuestionAnswerState(question, answer) {
  const selectedOptions = answer ? (answer.selectedOptions || []).slice() : [];
  const customInput = answer ? answer.customInput || "" : "";

  return {
    selectedOptions,
    currentOptions: createOptionItems(question, selectedOptions),
    customInput,
  };
}

function createQuestionSessionState(session, answer) {
  const currentQuestion = getCurrentQuestion(session);

  return Object.assign(createQuestionAnswerState(currentQuestion, answer), {
    session,
    currentQuestion,
    canStartResearch: canStartResearch(session),
    isLastQuestion: isLastQuestion(session),
    canGoPrevious: canGoPrevious(session),
  });
}

function createFreshSessionState(idea) {
  return createQuestionSessionState(createIncubationSession(idea));
}

Page({
  data: {
    ideaInput: "",
    examples: [
      "小红书选题助手",
      "自由职业报价",
      "项目 PRD 生成",
      "商家会员小程序",
    ],
    ideaSenderPresets: [{ name: "send", type: "icon" }],
    ideaSenderTextareaProps: { autosize: { minHeight: 72, maxHeight: 180 } },
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
    canGoPrevious: false,
    researchSteps,
    activeResearchStep: 0,
    completedResearchSteps: [],
    researchStepItems: createResearchStepItems(0, []),
    generatedProject: null,
  },

  onLoad() {
    this.projectStore = createGeneratedProjectStore();
    this.researchTimer = null;
    this.researchRunId = 0;
    this.refreshRecentProjects();
  },

  onShow() {
    if (this.projectStore) {
      this.refreshRecentProjects();
    }
  },

  refreshRecentProjects() {
    const recentProjects = this.projectStore
      .getProjects()
      .slice(0, 3)
      .map(withFormattedCreatedAt);
    this.setData({ recentProjects });
  },

  onIdeaInput(event) {
    this.setData({
      ideaInput: event.detail.value.trimStart(),
    });
  },

  onUseExample(event) {
    this.setData({
      ideaInput: event.currentTarget.dataset.value,
    });
  },

  onStartIncubation(event) {
    const nextIdea =
      event && event.detail && typeof event.detail.value === "string"
        ? event.detail.value.trimStart()
        : this.data.ideaInput;
    const idea = nextIdea.trim();

    if (!idea) {
      showToast({
        context: this,
        selector: "#t-toast",
        message: "先输入一个项目想法",
        theme: "warning",
      });
      return;
    }

    this.stopResearchProgress();

    this.setData({
      ideaInput: nextIdea,
      modalVisible: true,
      modalStage: "question",
      stageText: "正在补充关键信息",
      ...createFreshSessionState(idea),
      activeResearchStep: 0,
      completedResearchSteps: [],
      researchStepItems: createResearchStepItems(0, []),
      generatedProject: null,
    });
  },

  createOptionItems(question, selectedOptions) {
    return createOptionItems(question, selectedOptions);
  },

  onCloseModal() {
    this.stopResearchProgress();
    this.setData({
      modalVisible: false,
    });
  },

  onModalVisibleChange(event) {
    if (!event.detail.visible) {
      this.stopResearchProgress();
    }

    this.setData({
      modalVisible: event.detail.visible,
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
        currentOptions: this.createOptionItems(question, [value]),
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
      currentOptions: this.createOptionItems(question, selectedOptions),
    });
  },

  onCustomInput(event) {
    this.setData({
      customInput: event.detail.value,
    });
  },

  onModalIdeaInput(event) {
    const ideaInput = event.detail.value.trimStart();

    this.stopResearchProgress();
    this.setData({
      ideaInput,
      modalStage: "question",
      stageText: "正在补充关键信息",
      ...createFreshSessionState(ideaInput),
      activeResearchStep: 0,
      completedResearchSteps: [],
      researchStepItems: createResearchStepItems(0, []),
      generatedProject: null,
    });
  },

  onPreviousQuestion() {
    if (!this.data.canGoPrevious) {
      return;
    }

    const answerToRestore =
      this.data.session.answers[this.data.session.answers.length - 1];
    const previousSession = goToPreviousQuestion(this.data.session);

    this.setData({
      ...createQuestionSessionState(previousSession, answerToRestore),
    });
  },

  onNextQuestion() {
    if (!hasAnswer(this.data.selectedOptions, this.data.customInput)) {
      showToast({
        context: this,
        selector: "#t-toast",
        message: "请选择或补充一点信息",
        theme: "warning",
      });
      return;
    }

    const answeredLastQuestion = this.data.isLastQuestion;
    const nextSession = answerCurrentQuestion(this.data.session, {
      selectedOptions: this.data.selectedOptions,
      customInput: this.data.customInput.trim(),
    });

    if (answeredLastQuestion) {
      this.setData({
        session: nextSession,
        selectedOptions: [],
        customInput: "",
        canStartResearch: true,
        isLastQuestion: false,
        canGoPrevious: canGoPrevious(nextSession),
      });
      this.startResearchProgress();
      return;
    }

    this.setData({
      ...createQuestionSessionState(nextSession),
    });
  },

  startResearchProgress() {
    this.stopResearchProgress();
    this.researchRunId += 1;
    const runId = this.researchRunId;

    this.setData({
      modalStage: "research",
      stageText: "正在调研市场",
      activeResearchStep: 0,
      completedResearchSteps: [],
      researchStepItems: createResearchStepItems(0, []),
    });

    this.runResearchStep(0, runId);
  },

  runResearchStep(stepIndex, runId) {
    if (runId !== this.researchRunId || !this.data.modalVisible) {
      return;
    }

    if (stepIndex >= this.data.researchSteps.length) {
      const generatedProject = generateProjectResult(this.data.session);
      this.researchTimer = null;
      this.setData({
        modalStage: "result",
        stageText: "已生成方向建议",
        generatedProject,
      });
      return;
    }

    this.setData({
      activeResearchStep: stepIndex,
      researchStepItems: createResearchStepItems(
        stepIndex,
        this.data.completedResearchSteps,
      ),
    });

    this.researchTimer = setTimeout(() => {
      if (runId !== this.researchRunId || !this.data.modalVisible) {
        return;
      }

      const completedResearchSteps =
        this.data.completedResearchSteps.concat(stepIndex);
      this.setData({
        completedResearchSteps,
        researchStepItems: createResearchStepItems(
          stepIndex,
          completedResearchSteps,
        ),
      });
      this.runResearchStep(stepIndex + 1, runId);
    }, 650);
  },

  stopResearchProgress() {
    this.researchRunId += 1;

    if (this.researchTimer) {
      clearTimeout(this.researchTimer);
      this.researchTimer = null;
    }
  },

  onRegenerate() {
    this.startResearchProgress();
  },

  onModifyDirection() {
    const idea =
      this.data.ideaInput || (this.data.session && this.data.session.idea);

    this.stopResearchProgress();
    this.setData({
      modalStage: "question",
      stageText: "正在补充关键信息",
      ...createFreshSessionState(idea),
      generatedProject: null,
    });
  },

  onConfirmDirection() {
    const generatedProject = this.data.generatedProject;

    if (!generatedProject) {
      showToast({
        context: this,
        selector: "#t-toast",
        message: "暂无可保存的方向",
        theme: "warning",
      });
      return;
    }

    try {
      this.projectStore.saveProject(generatedProject);
    } catch (error) {
      showToast({
        context: this,
        selector: "#t-toast",
        message: "保存失败，请稍后重试",
        theme: "error",
      });
      return;
    }

    this.setData({
      modalVisible: false,
      generatedProject: null,
    });

    wx.switchTab({
      url: "/pages/workspace/index",
      success: () => {
        this.refreshRecentProjects();
      },
      fail: () => {
        showToast({
          context: this,
          selector: "#t-toast",
          message: "已保存，可到工作台查看",
          theme: "success",
        });
        this.refreshRecentProjects();
      },
    });
  },

  onUnload() {
    this.stopResearchProgress();
  },
});
