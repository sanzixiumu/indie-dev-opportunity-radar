const {
  createCloudFunctionClient,
  createFriendlyErrorMessage,
} = require("../../lib/cloud-functions");
const {
  createIncubationSession,
  getCurrentQuestion,
  answerCurrentQuestion,
  goToPreviousQuestion,
} = require("../../lib/incubation-service");
const ToastModule = require("tdesign-miniprogram/toast/index");

const showToast = ToastModule.default || ToastModule.showToast || ToastModule;

const examples = [
  "AI 帮我整理小红书选题",
  "给自由职业者做报价管理工具",
  "帮程序员快速生成项目 PRD",
  "面向本地商家的会员小程序",
];

const researchStepLabels = [
  "正在联网查询国内外优秀产品",
  "正在对比产品优劣",
  "正在分析产品方向",
];

function createStageText(stage) {
  const map = {
    creating_questions: "正在补充关键信息",
    questioning: "正在补充关键信息",
    researching: "正在调研市场",
    result: "已生成方向建议",
    saving: "正在保存方向",
  };

  return map[stage] || "AI灵感孵化";
}

function createSelectedOptionMap(values) {
  return (values || []).reduce((map, value) => {
    map[value] = true;
    return map;
  }, {});
}

function normalizeOptions(options) {
  return (options || []).map((option) => {
    if (typeof option === "string") {
      return {
        label: option,
        value: option,
      };
    }

    const value = String(option.value || option.label || "");
    return {
      label: option.label || value,
      value,
    };
  });
}

function normalizeQuestion(question, index) {
  return {
    questionId: question.questionId || question.id || `question_${index + 1}`,
    title: question.title || `问题 ${index + 1}`,
    description: question.description || "",
    type: question.type === "multiple" ? "multiple" : "single",
    options: normalizeOptions(question.options),
    allowCustomInput: Boolean(question.allowCustomInput),
    isRequired: question.isRequired !== false,
  };
}

function normalizeQuestions(questions) {
  return (questions || []).map(normalizeQuestion);
}

function createResearchSteps(activeStep) {
  return researchStepLabels.map((label, index) => ({
    label,
    status: index < activeStep ? "done" : index === activeStep ? "active" : "",
    done: index < activeStep,
    active: index === activeStep,
  }));
}

function hasCurrentAnswer(selectedOptions, customInput) {
  return selectedOptions.length > 0 || Boolean(customInput.trim());
}

function formatRecentProject(project) {
  return {
    ...project,
    summary:
      project.entryDirection ||
      project.conclusion ||
      project.sourceIdea ||
      "已生成方向建议",
    createdAtText: project.createdAt || project.created_at || "",
  };
}

function createLegacyOptionItems(question, selectedOptions) {
  if (!question) {
    return [];
  }

  return question.options.map((label) => ({
    label,
    selected: selectedOptions.indexOf(label) > -1,
  }));
}

function createLegacySessionState(session, answer) {
  const currentQuestion = getCurrentQuestion(session);
  const selectedOptions = answer ? (answer.selectedOptions || []).slice() : [];
  const customInput = answer ? answer.customInput || "" : "";

  return {
    session,
    currentQuestion,
    selectedOptions,
    currentOptions: createLegacyOptionItems(currentQuestion, selectedOptions),
    customInput,
    canGoPrevious: session.currentQuestionIndex > 0,
  };
}

Page({
  data: {
    ideaInput: "",
    ideaAutosize: { minRows: 4, maxRows: 7 },
    customAutosize: { minRows: 2, maxRows: 4 },
    examples,
    ideaSenderPresets: [{ name: "send", type: "icon" }],
    ideaSenderTextareaProps: { autosize: { minHeight: 72, maxHeight: 180 } },
    recentProjects: [],
    modalVisible: false,
    stage: "idle",
    stageText: "AI灵感孵化",
    questions: [],
    currentQuestionIndex: 0,
    answers: [],
    currentSelectedOptions: [],
    selectedOptionMap: {},
    currentCustomInput: "",
    researchSteps: createResearchSteps(0),
    activeResearchStep: 0,
    projectResult: null,
    errorMessage: "",
    loadingRecent: false,
    session: null,
    currentQuestion: null,
    selectedOptions: [],
    currentOptions: [],
    customInput: "",
    canGoPrevious: false,
    modalStage: "question",
    generatedProject: null,
  },

  onLoad() {
    this.client = createCloudFunctionClient(wx.cloud);
    this.researchTimer = null;
    this.incubationRunId = 0;
    this.loadRecentProjects();
  },

  onShow() {
    if (this.client) {
      this.loadRecentProjects();
    }
  },

  ensureClient() {
    if (!this.client && typeof wx !== "undefined" && wx.cloud) {
      this.client = createCloudFunctionClient(wx.cloud);
    }

    return this.client;
  },

  async loadRecentProjects() {
    this.setData({ loadingRecent: true });

    try {
      const client = this.ensureClient();

      if (!client) {
        return;
      }

      const data = await client.call("listGeneratedProjects", {
        page: 1,
        page_size: 3,
      });
      this.setData({
        recentProjects: (data.items || []).map(formatRecentProject),
      });
    } catch (error) {
      this.setData({ errorMessage: createFriendlyErrorMessage(error) });
    } finally {
      this.setData({ loadingRecent: false });
    }
  },

  onIdeaInput(event) {
    this.setData({
      ideaInput: event.detail.value.trimStart(),
    });
  },

  onSelectExample(event) {
    this.setData({
      ideaInput: event.currentTarget.dataset.value,
      errorMessage: "",
    });
  },

  onUseExample(event) {
    this.onSelectExample(event);
  },

  async onStartIncubation(event) {
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

    const client = this.ensureClient();

    if (!client) {
      this.createRunId();
      this.stopResearchProgress();
      const session = createIncubationSession(idea);
      this.setData({
        ideaInput: idea,
        modalVisible: true,
        stage: "questioning",
        stageText: createStageText("questioning"),
        questions: normalizeQuestions(session.questions),
        currentQuestionIndex: 0,
        answers: [],
        currentSelectedOptions: [],
        selectedOptionMap: {},
        currentCustomInput: "",
        researchSteps: createResearchSteps(0),
        activeResearchStep: 0,
        projectResult: null,
        errorMessage: "",
        ...createLegacySessionState(session),
      });
      return;
    }

    this.setData({
      ideaInput: nextIdea,
    });

    await this.generateIncubationQuestions(idea, { showModal: true });
  },

  async generateIncubationQuestions(idea, options = {}) {
    const normalizedIdea = (idea || "").trim();

    if (!normalizedIdea) {
      showToast({
        context: this,
        selector: "#t-toast",
        message: "先输入一个项目想法",
        theme: "warning",
      });
      return;
    }

    const client = this.ensureClient();

    if (!client) {
      const session = createIncubationSession(normalizedIdea);
      this.setData({
        ideaInput: normalizedIdea,
        modalVisible: options.showModal ? true : this.data.modalVisible,
        stage: "questioning",
        stageText: createStageText("questioning"),
        questions: normalizeQuestions(session.questions),
        currentQuestionIndex: 0,
        answers: [],
        currentSelectedOptions: [],
        selectedOptionMap: {},
        currentCustomInput: "",
        researchSteps: createResearchSteps(0),
        activeResearchStep: 0,
        projectResult: null,
        errorMessage: "",
        ...createLegacySessionState(session),
      });
      return;
    }

    const runId = this.createRunId();
    this.stopResearchProgress();
    this.setData({
      ideaInput: normalizedIdea,
      modalVisible: options.showModal ? true : this.data.modalVisible,
      stage: "creating_questions",
      stageText: createStageText("creating_questions"),
      questions: [],
      currentQuestionIndex: 0,
      answers: [],
      currentSelectedOptions: [],
      selectedOptionMap: {},
      currentCustomInput: "",
      researchSteps: createResearchSteps(0),
      activeResearchStep: 0,
      projectResult: null,
      errorMessage: "",
    });

    try {
      const data = await client.call("createIncubationQuestions", {
        idea: normalizedIdea,
      });
      if (!this.isCurrentRun(runId)) {
        return;
      }

      const questions = normalizeQuestions(data.questions);

      if (!questions.length) {
        throw new Error("AI 暂未生成追问问题，请稍后重试。");
      }

      this.setData({
        stage: "questioning",
        stageText: createStageText("questioning"),
        questions,
      });
    } catch (error) {
      if (!this.isCurrentRun(runId)) {
        return;
      }

      this.setData({
        stage: "questioning",
        stageText: createStageText("questioning"),
        errorMessage: createFriendlyErrorMessage(error),
      });
    }
  },

  onRegenerateQuestions() {
    return this.generateIncubationQuestions(this.data.ideaInput);
  },

  onCloseModal() {
    this.invalidateIncubationRun();
    this.setData({
      modalVisible: false,
    });
  },

  onModalVisibleChange(event) {
    if (!event.detail.visible) {
      this.invalidateIncubationRun();
    }

    this.setData({
      modalVisible: event.detail.visible,
    });
  },

  onSelectOption(event) {
    const value = event.currentTarget.dataset.value;
    const question = this.data.questions[this.data.currentQuestionIndex];

    if (!question || !value) {
      return;
    }

    const selectedOptions = this.data.currentSelectedOptions.slice();
    const selectedIndex = selectedOptions.indexOf(value);

    if (question.type === "multiple") {
      if (selectedIndex > -1) {
        selectedOptions.splice(selectedIndex, 1);
      } else {
        selectedOptions.push(value);
      }
    } else {
      selectedOptions.splice(0, selectedOptions.length, value);
    }

    this.setData({
      currentSelectedOptions: selectedOptions,
      selectedOptionMap: createSelectedOptionMap(selectedOptions),
      errorMessage: "",
    });
  },

  onToggleOption(event) {
    this.onSelectOption(event);
  },

  onCustomInput(event) {
    this.setData({
      currentCustomInput: event.detail.value,
      errorMessage: "",
    });
  },

  onModalIdeaInput(event) {
    const ideaInput = event.detail.value.trimStart();
    this.invalidateIncubationRun();

    if (this.data.session || !this.ensureClient()) {
      const session = createIncubationSession(ideaInput);
      this.setData({
        ideaInput,
        stage: "questioning",
        stageText: createStageText("questioning"),
        questions: normalizeQuestions(session.questions),
        currentQuestionIndex: 0,
        answers: [],
        currentSelectedOptions: [],
        selectedOptionMap: {},
        currentCustomInput: "",
        projectResult: null,
        errorMessage: "",
        ...createLegacySessionState(session),
      });
      return;
    }

    this.setData({
      ideaInput,
      stage: "questioning",
      stageText: createStageText("questioning"),
      questions: [],
      currentQuestionIndex: 0,
      answers: [],
      currentSelectedOptions: [],
      selectedOptionMap: {},
      currentCustomInput: "",
      projectResult: null,
      generatedProject: null,
      errorMessage: "",
    });
  },

  saveCurrentAnswer() {
    const question = this.data.questions[this.data.currentQuestionIndex];
    const answers = this.data.answers.slice();

    if (!question) {
      return answers;
    }

    answers[this.data.currentQuestionIndex] = {
      questionId: question.questionId,
      questionTitle: question.title,
      selectedOptions: this.data.currentSelectedOptions.slice(),
      customInput: this.data.currentCustomInput.trim(),
    };

    this.setData({ answers });
    return answers;
  },

  restoreQuestionState(questionIndex, answers) {
    const answer = answers[questionIndex] || {};
    const selectedOptions = answer.selectedOptions || [];

    this.setData({
      currentQuestionIndex: questionIndex,
      currentSelectedOptions: selectedOptions,
      selectedOptionMap: createSelectedOptionMap(selectedOptions),
      currentCustomInput: answer.customInput || "",
      errorMessage: "",
    });
  },

  onPreviousQuestion() {
    if (this.data.session) {
      if (this.data.session.currentQuestionIndex <= 0) {
        return;
      }

      const answerToRestore =
        this.data.session.answers[this.data.session.answers.length - 1];
      const previousSession = goToPreviousQuestion(this.data.session);
      this.setData({
        ...createLegacySessionState(previousSession, answerToRestore),
      });
      return;
    }

    if (this.data.currentQuestionIndex <= 0) {
      return;
    }

    const answers = this.saveCurrentAnswer();
    this.restoreQuestionState(this.data.currentQuestionIndex - 1, answers);
  },

  onNextQuestion() {
    const selectedOptions = this.data.session
      ? this.data.selectedOptions
      : this.data.currentSelectedOptions;
    const customInput = this.data.session
      ? this.data.customInput
      : this.data.currentCustomInput;

    if (
      !hasCurrentAnswer(
        selectedOptions,
        customInput,
      )
    ) {
      showToast({
        context: this,
        selector: "#t-toast",
        message: "请选择或补充一点信息",
        theme: "warning",
      });
      return;
    }

    if (this.data.session) {
      const nextSession = answerCurrentQuestion(this.data.session, {
        selectedOptions,
        customInput: customInput.trim(),
      });
      this.setData({
        ...createLegacySessionState(nextSession),
      });
      return;
    }

    const answers = this.saveCurrentAnswer();
    const nextIndex = this.data.currentQuestionIndex + 1;

    if (nextIndex >= this.data.questions.length) {
      this.startResearch(answers);
      return;
    }

    this.restoreQuestionState(nextIndex, answers);
  },

  async startResearch(answers) {
    const runId = this.createRunId();
    this.stopResearchProgress();
    this.setData({
      stage: "researching",
      stageText: createStageText("researching"),
      activeResearchStep: 0,
      researchSteps: createResearchSteps(0),
      errorMessage: "",
    });

    this.researchTimer = setInterval(() => {
      if (!this.isCurrentRun(runId) || this.data.stage !== "researching") {
        return;
      }

      const nextStep = Math.min(
        this.data.activeResearchStep + 1,
        researchStepLabels.length - 1,
      );
      this.setData({
        activeResearchStep: nextStep,
        researchSteps: createResearchSteps(nextStep),
      });
    }, 1200);

    try {
      const data = await this.client.call("generateIncubationAnalysis", {
        idea: this.data.ideaInput.trim(),
        answers,
      });
      if (!this.isCurrentRun(runId)) {
        return;
      }

      this.stopResearchProgress();
      this.setData({
        stage: "result",
        stageText: createStageText("result"),
        activeResearchStep: researchStepLabels.length,
        researchSteps: createResearchSteps(researchStepLabels.length),
        projectResult: data.project,
      });
    } catch (error) {
      if (!this.isCurrentRun(runId)) {
        return;
      }

      this.stopResearchProgress();
      this.setData({
        stage: "questioning",
        stageText: createStageText("questioning"),
        errorMessage: createFriendlyErrorMessage(error),
      });
    }
  },

  onRegenerate() {
    const answers = this.data.answers.filter(Boolean);

    if (!answers.length) {
      this.setData({
        stage: "questioning",
        stageText: createStageText("questioning"),
      });
      return;
    }

    this.startResearch(answers);
  },

  onModifyDirection() {
    this.invalidateIncubationRun();

    if (this.data.session) {
      const session = createIncubationSession(this.data.ideaInput);
      this.setData({
        stage: "questioning",
        stageText: createStageText("questioning"),
        projectResult: null,
        errorMessage: "",
        ...createLegacySessionState(session),
      });
      return;
    }

    const firstAnswer = this.data.answers[0] || {};
    const selectedOptions = firstAnswer.selectedOptions || [];

    this.setData({
      stage: "questioning",
      stageText: createStageText("questioning"),
      currentQuestionIndex: 0,
      currentSelectedOptions: selectedOptions,
      selectedOptionMap: createSelectedOptionMap(selectedOptions),
      currentCustomInput: firstAnswer.customInput || "",
      projectResult: null,
      errorMessage: "",
    });
  },

  onEditDirection() {
    this.onModifyDirection();
  },

  async onConfirmProject() {
    const project = this.data.projectResult;

    if (!project) {
      showToast({
        context: this,
        selector: "#t-toast",
        message: "暂无可保存的方向",
        theme: "warning",
      });
      return;
    }

    this.setData({
      stage: "saving",
      stageText: createStageText("saving"),
      errorMessage: "",
    });

    try {
      await this.client.call("saveGeneratedProject", { project });
      this.setData({
        modalVisible: false,
      });
      wx.switchTab({
        url: "/pages/workspace/index",
      });
    } catch (error) {
      this.setData({
        stage: "result",
        stageText: createStageText("result"),
        projectResult: project,
        errorMessage: createFriendlyErrorMessage(error),
      });
    }
  },

  onConfirmDirection() {
    this.onConfirmProject();
  },

  onUnload() {
    this.invalidateIncubationRun();
  },

  createRunId() {
    this.incubationRunId = (this.incubationRunId || 0) + 1;
    return this.incubationRunId;
  },

  isCurrentRun(runId) {
    return this.incubationRunId === runId && this.data.modalVisible;
  },

  invalidateIncubationRun() {
    this.createRunId();
    this.stopResearchProgress();
  },

  stopResearchProgress() {
    if (this.researchTimer) {
      clearInterval(this.researchTimer);
      this.researchTimer = null;
    }
  },
});
