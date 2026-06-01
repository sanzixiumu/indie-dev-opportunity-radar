const { appError } = require("../../response");

async function callDoubao({
  baseUrl,
  apiKey,
  model,
  messages,
  responseFormat,
  tools,
  temperature,
  requestId
}) {
  const resolvedTools = tools || [{ type: "web_search" }];

  try {
    const axios = require("axios");
    const response = await axios.post(`${baseUrl}/responses`, {
      model,
      input: messages,
      tools: resolvedTools,
      temperature,
      ...resolveTextFormat(responseFormat)
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Request-Id": requestId
      }
    });

    return {
      provider: "doubao",
      model,
      text: extractResponseText(response.data),
      tools: resolvedTools
    };
  } catch (error) {
    throw mapProviderError(error);
  }
}

function extractResponseText(data) {
  const textParts = data?.output
    ?.filter((item) => item.type === "message")
    ?.flatMap((item) => item.content || [])
    ?.filter((part) => part.type === "output_text")
    ?.map((part) => part.text || "");

  return textParts?.join("") || "";
}

function resolveTextFormat(responseFormat) {
  if (!responseFormat) {
    return {};
  }

  return {
    text: {
      format: responseFormat
    }
  };
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

module.exports = callDoubao;
