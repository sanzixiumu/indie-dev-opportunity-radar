const { renderResearchPrompt } = require("./_shared/prompts/incubation");
const {
  normalizeAnalysisPayload,
  normalizeAnswers,
  validateIdea,
} = require("./_shared/validators/incubation");
const {
  appError,
  createRequestId,
  normalizeError,
  okResponse,
} = require("./_shared/response");

/**
 * @typedef {{
 *   callModel(options: {
 *     taskType: "web_research",
 *     provider?: unknown,
 *     model?: unknown,
 *     messages: Array<{ role: "user", content: string }>,
 *     tools: Array<{ type: "web_search" }>,
 *     responseFormat: { type: "json_object" },
 *     temperature: number,
 *     requestId: string
 *   }): Promise<{ provider?: string, model?: string, text?: string }>
 * }} AiGateway
 *
 * @typedef {{
 *   gateway: AiGateway,
 *   now(): string,
 *   reasoningModelInfo?: {
 *     provider?: string,
 *     model?: string
 *   }
 * }} GenerateIncubationAnalysisDeps
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} text
 */
function parseModelJson(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch (_error) {
    throw appError("AI_OUTPUT_INVALID", "ai_output", "AI 输出不是合法 JSON", "retry");
  }
}

/**
 * @param {GenerateIncubationAnalysisDeps} deps
 */
function createGenerateIncubationAnalysis({ gateway, now, reasoningModelInfo }) {
  const resolvedReasoningModelInfo = {
    provider: reasoningModelInfo?.provider || "deepseek",
    model: reasoningModelInfo?.model || "deepseek-v4-pro",
  };

  return async (event, _context) => {
    const requestId = createRequestId(now);

    try {
      const payload = isRecord(event) ? event : {};
      const idea = validateIdea(payload.idea);
      const answers = normalizeAnswers(payload.answers);
      const prompt = renderResearchPrompt({ idea, answers });
      const modelResult = await gateway.callModel({
        taskType: "web_research",
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search" }],
        responseFormat: { type: "json_object" },
        temperature: 0.1,
        requestId,
      });
      const analysis = normalizeAnalysisPayload(parseModelJson(modelResult.text));

      return okResponse(
        {
          project: {
            sourceIdea: idea,
            answers,
            ...analysis,
            modelInfo: {
              reasoningProvider: resolvedReasoningModelInfo.provider,
              reasoningModel: resolvedReasoningModelInfo.model,
              researchProvider: modelResult.provider || "",
              researchModel: modelResult.model || "",
            },
            favoriteStatus: false,
            compareStatus: false,
          },
        },
        requestId,
      );
    } catch (error) {
      return normalizeError(error, requestId);
    }
  };
}

module.exports = {
  createGenerateIncubationAnalysis,
};
