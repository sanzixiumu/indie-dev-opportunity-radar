const { appError } = require("../../response");

async function callDeepseek({
  baseUrl,
  apiKey,
  model,
  messages,
  responseFormat,
  temperature,
  requestId
}) {
  try {
    const axios = require("axios");
    const response = await axios.post(`${baseUrl}/chat/completions`, {
      model,
      messages,
      response_format: responseFormat || { type: "json_object" },
      temperature
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Request-Id": requestId
      }
    });

    return {
      provider: "deepseek",
      model,
      text: extractChatText(response.data)
    };
  } catch (error) {
    throw mapProviderError(error);
  }
}

function extractChatText(data) {
  return data?.choices?.[0]?.message?.content || data?.output_text || "";
}

function mapProviderError(error) {
  const status = error?.response?.status;

  if (status === 401 || status === 403) {
    return appError(
      "MODEL_AUTH_FAILED",
      "authentication",
      "AI provider authentication failed",
      "configure_model"
    );
  }

  return appError(
    "AI_GENERATION_FAILED",
    "ai_generation",
    "AI generation failed",
    "retry"
  );
}

module.exports = callDeepseek;
