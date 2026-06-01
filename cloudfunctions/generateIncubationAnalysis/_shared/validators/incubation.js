const { appError } = require("../response");

function validationError(message) {
  return appError("VALIDATION_ERROR", "validation", message, "edit_input");
}

function aiOutputError(message) {
  return appError("AI_OUTPUT_INVALID", "ai_output", message, "retry");
}

function normalizeString(value, fieldName) {
  if (value == null) {
    throw aiOutputError(`${fieldName} 不能为空`);
  }

  const normalized = String(value).trim();

  if (!normalized) {
    throw aiOutputError(`${fieldName} 不能为空`);
  }

  return normalized;
}

function normalizeOptionalString(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeUserString(value, fieldName) {
  if (value == null) {
    throw validationError(`${fieldName} 不能为空`);
  }

  const normalized = String(value).trim();

  if (!normalized) {
    throw validationError(`${fieldName} 不能为空`);
  }

  return normalized;
}

function normalizeUserStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw validationError(`${fieldName} 必须是数组`);
  }

  return value.map((item) => normalizeUserString(item, fieldName));
}

function normalizeBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw aiOutputError(`${fieldName} 必须是布尔值`);
  }

  return value;
}

function normalizeStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw aiOutputError(`${fieldName} 必须是数组`);
  }

  return value.map((item) => normalizeString(item, fieldName));
}

function normalizeObjectArray(value, fieldName, normalizer) {
  if (!Array.isArray(value)) {
    throw aiOutputError(`${fieldName} 必须是数组`);
  }

  return value.map(normalizer);
}

function validateIdea(idea) {
  const normalized = idea == null ? "" : String(idea).trim();

  if (!normalized) {
    throw validationError("项目灵感不能为空，请先输入一个想法");
  }

  return normalized;
}

function normalizeInitialAssessment(initialAssessment) {
  if (!initialAssessment || typeof initialAssessment !== "object") {
    throw aiOutputError("initialAssessment 必须是对象");
  }

  return {
    summary: normalizeString(initialAssessment.summary, "initialAssessment.summary"),
    missingInfo: normalizeStringArray(initialAssessment.missingInfo, "initialAssessment.missingInfo"),
    readyForResearch: normalizeBoolean(
      initialAssessment.readyForResearch,
      "initialAssessment.readyForResearch",
    ),
  };
}

function normalizeQuestionOption(option) {
  if (!option || typeof option !== "object") {
    throw aiOutputError("question.options 必须包含选项对象");
  }

  return {
    label: normalizeString(option.label, "question.option.label"),
    value: normalizeString(option.value, "question.option.value"),
  };
}

function normalizeQuestion(question) {
  if (!question || typeof question !== "object") {
    throw aiOutputError("questions 必须包含问题对象");
  }

  const type = normalizeString(question.type, "question.type");

  if (!["single", "multiple"].includes(type)) {
    throw aiOutputError("question.type 必须是 single 或 multiple");
  }

  const options = normalizeObjectArray(question.options, "question.options", normalizeQuestionOption);
  const allowCustomInput = Boolean(question.allowCustomInput);

  if (options.length === 0 && allowCustomInput !== true) {
    throw aiOutputError("single/multiple 问题必须提供选项，除非允许自由输入");
  }

  return {
    questionId: normalizeString(question.questionId, "question.questionId"),
    title: normalizeString(question.title, "question.title"),
    description: normalizeString(question.description, "question.description"),
    type,
    options,
    allowCustomInput,
    isRequired: question.isRequired !== false,
  };
}

function normalizeQuestionPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw aiOutputError("问题生成结果必须是对象");
  }

  const questions = normalizeObjectArray(payload.questions, "questions", normalizeQuestion);

  if (questions.length === 0) {
    throw aiOutputError("questions 必须至少包含一个问题");
  }

  return {
    initialAssessment: normalizeInitialAssessment(payload.initialAssessment),
    questions,
  };
}

function normalizeProduct(product) {
  if (!product || typeof product !== "object") {
    throw aiOutputError("products 必须包含产品对象");
  }

  return {
    name: normalizeString(product.name, "product.name"),
    positioning: normalizeString(product.positioning, "product.positioning"),
    strengths: normalizeString(product.strengths, "product.strengths"),
    weaknesses: normalizeString(product.weaknesses, "product.weaknesses"),
    evidence: normalizeString(product.evidence, "product.evidence"),
  };
}

function normalizeRisk(risk) {
  if (!risk || typeof risk !== "object") {
    throw aiOutputError("risks 必须包含风险对象");
  }

  return {
    description: normalizeString(risk.description, "risk.description"),
    source: normalizeString(risk.source, "risk.source"),
  };
}

function normalizeSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== "object") {
    throw aiOutputError("suggestions 必须包含建议对象");
  }

  const priority = normalizeString(suggestion.priority, "suggestion.priority");

  if (!["P0", "P1", "P2"].includes(priority)) {
    throw aiOutputError("suggestion.priority 必须是 P0、P1 或 P2");
  }

  return {
    priority,
    action: normalizeString(suggestion.action, "suggestion.action"),
    expectedSignal: normalizeString(suggestion.expectedSignal, "suggestion.expectedSignal"),
  };
}

function normalizeResearchSource(source) {
  if (!source || typeof source !== "object") {
    throw aiOutputError("researchSources 必须包含来源对象");
  }

  return {
    title: normalizeString(source.title, "researchSource.title"),
    url: normalizeOptionalString(source.url),
    summary: normalizeString(source.summary, "researchSource.summary"),
  };
}

function normalizeAnalysisPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw aiOutputError("分析结果必须是对象");
  }

  return {
    title: normalizeString(payload.title, "title"),
    conclusion: normalizeString(payload.conclusion, "conclusion"),
    limitedInfo: normalizeBoolean(payload.limitedInfo, "limitedInfo"),
    limitedInfoReason: normalizeOptionalString(payload.limitedInfoReason),
    domesticProducts: normalizeObjectArray(
      payload.domesticProducts,
      "domesticProducts",
      normalizeProduct,
    ),
    globalProducts: normalizeObjectArray(payload.globalProducts, "globalProducts", normalizeProduct),
    entryDirection: normalizeString(payload.entryDirection, "entryDirection"),
    advantages: normalizeStringArray(payload.advantages, "advantages"),
    risks: normalizeObjectArray(payload.risks, "risks", normalizeRisk),
    suggestions: normalizeObjectArray(payload.suggestions, "suggestions", normalizeSuggestion),
    researchSources: normalizeObjectArray(
      payload.researchSources,
      "researchSources",
      normalizeResearchSource,
    ),
  };
}

function normalizeAnswer(answer) {
  if (!answer || typeof answer !== "object") {
    throw validationError("answers 必须包含回答对象");
  }

  return {
    questionId: normalizeUserString(answer.questionId, "answer.questionId"),
    questionTitle: normalizeUserString(answer.questionTitle, "answer.questionTitle"),
    selectedOptions: normalizeUserStringArray(answer.selectedOptions || [], "answer.selectedOptions"),
    customInput: normalizeOptionalString(answer.customInput),
  };
}

function normalizeAnswers(answers) {
  if (!Array.isArray(answers)) {
    throw validationError("answers 必须是数组");
  }

  return answers.map(normalizeAnswer);
}

function normalizeModelInfo(modelInfo) {
  if (!modelInfo || typeof modelInfo !== "object") {
    throw aiOutputError("modelInfo 必须是对象");
  }

  return {
    reasoningProvider: normalizeString(
      modelInfo.reasoningProvider || modelInfo.reasoning_provider,
      "modelInfo.reasoningProvider",
    ),
    reasoningModel: normalizeString(
      modelInfo.reasoningModel || modelInfo.reasoning_model,
      "modelInfo.reasoningModel",
    ),
    researchProvider: normalizeString(
      modelInfo.researchProvider || modelInfo.research_provider,
      "modelInfo.researchProvider",
    ),
    researchModel: normalizeString(
      modelInfo.researchModel || modelInfo.research_model,
      "modelInfo.researchModel",
    ),
  };
}

function normalizeGeneratedProjectDraft(payload) {
  if (!payload || typeof payload !== "object") {
    throw aiOutputError("项目草稿必须是对象");
  }

  const analysis = normalizeAnalysisPayload(payload);

  return {
    sourceIdea: normalizeString(payload.sourceIdea, "sourceIdea"),
    answers: normalizeAnswers(payload.answers || []),
    ...analysis,
    modelInfo: normalizeModelInfo(payload.modelInfo),
    favoriteStatus: payload.favoriteStatus === true,
    compareStatus: payload.compareStatus === true,
  };
}

module.exports = {
  normalizeAnalysisPayload,
  normalizeAnswers,
  normalizeGeneratedProjectDraft,
  normalizeQuestionPayload,
  validateIdea,
};
