const {
  createCloudFunctionClient,
  createFriendlyErrorMessage,
} = require("../../lib/cloud-functions");

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toText(value) {
  return typeof value === "string" ? value : "";
}

function normalizeAnswer(answer, index) {
  const selectedOptions = toArray(answer && answer.selectedOptions).filter(Boolean);
  const customInput = toText(answer && answer.customInput);
  const parts = selectedOptions.concat(customInput ? [customInput] : []);

  return {
    questionId: toText(answer && answer.questionId) || `answer-${index}`,
    questionTitle: toText(answer && answer.questionTitle) || `问题 ${index + 1}`,
    selectedOptions,
    selectedOptionsText: selectedOptions.join("、"),
    customInput,
    answerSummary: parts.join(" / ") || "未填写",
  };
}

function normalizeProduct(product, index) {
  return {
    name: toText(product && product.name) || `产品 ${index + 1}`,
    positioning: toText(product && product.positioning),
    strengths: toText(product && product.strengths),
    weaknesses: toText(product && product.weaknesses),
    evidence: toText(product && product.evidence),
  };
}

function normalizeRisk(risk, index) {
  return {
    description: toText(risk && risk.description) || `风险 ${index + 1}`,
    source: toText(risk && risk.source),
  };
}

function normalizeSuggestion(suggestion, index) {
  const priority = toText(suggestion && suggestion.priority);
  const action = toText(suggestion && suggestion.action) || `建议 ${index + 1}`;
  const expectedSignal = toText(suggestion && suggestion.expectedSignal);

  return {
    priority,
    action,
    expectedSignal,
    suggestionSummary: [priority, action, expectedSignal].filter(Boolean).join(" · "),
  };
}

function normalizeResearchSource(source, index) {
  return {
    title: toText(source && source.title) || `来源 ${index + 1}`,
    url: toText(source && source.url),
    summary: toText(source && source.summary),
  };
}

function normalizeModelInfo(modelInfo) {
  const normalized = modelInfo && typeof modelInfo === "object" ? modelInfo : {};

  return {
    reasoningProvider: toText(normalized.reasoningProvider),
    reasoningModel: toText(normalized.reasoningModel),
    researchProvider: toText(normalized.researchProvider),
    researchModel: toText(normalized.researchModel),
  };
}

function createModelInfoRows(modelInfo) {
  return [
    {
      label: "推理模型",
      value: [modelInfo.reasoningProvider, modelInfo.reasoningModel].filter(Boolean).join(" / "),
    },
    {
      label: "调研模型",
      value: [modelInfo.researchProvider, modelInfo.researchModel].filter(Boolean).join(" / "),
    },
  ].filter((row) => row.value);
}

function normalizeProject(project, index) {
  const sourceIdea = toText(project && project.sourceIdea);
  const answers = toArray(project && project.answers).map(normalizeAnswer);
  const products = toArray(project && project.products).map(normalizeProduct);
  const domesticProducts = toArray(project && project.domesticProducts).map(normalizeProduct);
  const globalProducts = toArray(project && project.globalProducts).map(normalizeProduct);
  const advantages = toArray(project && project.advantages).filter(Boolean);
  const risks = toArray(project && project.risks).map(normalizeRisk);
  const suggestions = toArray(project && project.suggestions).map(normalizeSuggestion);
  const researchSources = toArray(project && project.researchSources).map(normalizeResearchSource);
  const modelInfo = normalizeModelInfo(project && project.modelInfo);
  const modelInfoRows = createModelInfoRows(modelInfo);
  const limitedInfo = Boolean(project && project.limitedInfo);
  const limitedInfoReason = toText(project && project.limitedInfoReason);

  return {
    id: toText(project && project.id) || `project-${index}`,
    sourceIdea,
    answers,
    title: toText(project && project.title) || "未命名项目",
    conclusion: toText(project && project.conclusion),
    limitedInfo,
    limitedInfoReason,
    products,
    domesticProducts,
    globalProducts,
    entryDirection: toText(project && project.entryDirection),
    advantages,
    risks,
    suggestions,
    researchSources,
    modelInfo,
    modelInfoRows,
    createdAt: toText(project && project.createdAt),
    favoriteStatus: Boolean(project && project.favoriteStatus),
    compareStatus: Boolean(project && project.compareStatus),
    riskCount: risks.length,
    hasSourceIdea: Boolean(sourceIdea),
    hasAnswers: answers.length > 0,
    hasDomesticProducts: domesticProducts.length > 0,
    hasGlobalProducts: globalProducts.length > 0,
    hasResearchSources: researchSources.length > 0,
    hasModelInfoRows: modelInfoRows.length > 0,
    hasLimitedInfoReason: limitedInfo && Boolean(limitedInfoReason),
    limitedInfoLabel: limitedInfo ? "信息有限" : "已调研",
    favoriteStatusLabel: project && project.favoriteStatus ? "已收藏" : "未收藏",
    compareStatusLabel: project && project.compareStatus ? "已加入对比" : "未加入对比",
  };
}

Page({
  data: {
    projects: [],
    hasProjects: false,
    loading: false,
    loadFailed: false,
    errorMessage: "",
    detailVisible: false,
    selectedProject: null,
  },

  onLoad() {
    this.client = createCloudFunctionClient(wx.cloud);
  },

  onShow() {
    this.loadProjects();
  },

  async loadProjects() {
    this.setData({
      loading: true,
      loadFailed: false,
      errorMessage: "",
    });

    try {
      const data = await this.client.call("listGeneratedProjects", {
        page: 1,
        page_size: 20,
      });

      const projects = toArray(data && data.items).map(normalizeProject);

      this.setData({
        projects,
        hasProjects: projects.length > 0,
      });
    } catch (error) {
      this.setData({
        loadFailed: true,
        errorMessage: createFriendlyErrorMessage(error),
      });
    } finally {
      this.setData({
        loading: false,
      });
    }
  },

  onOpenDetail(event) {
    const projectId = event.currentTarget.dataset.id;
    const selectedProject = this.data.projects.find(
      (project) => project.id === projectId,
    );

    this.setData({
      selectedProject,
      detailVisible: Boolean(selectedProject),
    });
  },

  onCloseDetail() {
    this.setData({
      detailVisible: false,
      selectedProject: null,
    });
  },

  onComingSoon() {
    wx.showToast({
      title: "即将支持",
      icon: "none",
    });
  },
});
