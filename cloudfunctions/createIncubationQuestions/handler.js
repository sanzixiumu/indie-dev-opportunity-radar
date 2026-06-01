const { renderQuestionPrompt } = require("./_shared/prompts/incubation");
const {
  normalizeQuestionPayload,
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
 *     taskType: "reasoning",
 *     provider?: unknown,
 *     model?: unknown,
 *     messages: Array<{ role: "user", content: string }>,
 *     responseFormat: { type: "json_object" },
 *     temperature: number,
 *     requestId: string
 *   }): Promise<{ provider?: string, model?: string, text?: string }>
 * }} AiGateway
 *
 * @typedef {{
 *   gateway: AiGateway,
 *   now(): string,
 *   createId(): string
 * }} CreateIncubationQuestionsDeps
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
 * @param {CreateIncubationQuestionsDeps} deps
 */
function createCreateIncubationQuestions({ gateway, now, createId }) {
  return async (event, _context) => {
    const requestId = createRequestId(now);

    try {
      const payload = isRecord(event) ? event : {};
      const idea = validateIdea(payload.idea);
      const prompt = renderQuestionPrompt(idea);
      const modelResult = await gateway.callModel({
        taskType: "reasoning",
        messages: [{ role: "user", content: prompt }],
        responseFormat: { type: "json_object" },
        temperature: 0.2,
        requestId,
      });
      const questionPayload = normalizeQuestionPayload(parseModelJson(modelResult.text));

      return okResponse(
        {
          session_id: createId(),
          initialAssessment: questionPayload.initialAssessment,
          questions: questionPayload.questions,
          modelInfo: {
            reasoningProvider: modelResult.provider || "",
            reasoningModel: modelResult.model || "",
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
  createCreateIncubationQuestions,
};
