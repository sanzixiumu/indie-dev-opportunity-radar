const UNKNOWN_ERROR = {
  code: "UNKNOWN_ERROR",
  type: "unknown",
  action: "retry",
  message: "服务暂时不可用，请稍后重试。",
};

const NETWORK_ERROR = {
  code: "NETWORK_ERROR",
  type: "network",
  action: "retry",
};

function createClientError(details) {
  const error = new Error(details.message || UNKNOWN_ERROR.message);
  error.code = details.code;
  error.type = details.type;
  error.action = details.action;
  return error;
}

function createUnknownError() {
  return createClientError(UNKNOWN_ERROR);
}

function normalizeBackendError(error) {
  if (!error || typeof error !== "object") {
    return UNKNOWN_ERROR;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const type = typeof error.type === "string" ? error.type : "";
  const action = typeof error.action === "string" ? error.action : "";

  if (!code || !type || !action) {
    return UNKNOWN_ERROR;
  }

  return {
    code,
    type,
    action,
    message:
      typeof error.message === "string" && error.message
        ? error.message
        : UNKNOWN_ERROR.message,
  };
}

function createNetworkError(error) {
  return createClientError({
    ...NETWORK_ERROR,
    message:
      error && typeof error.errMsg === "string" && error.errMsg
        ? error.errMsg
        : "网络连接失败，请稍后重试。",
  });
}

function unwrapCloudFunctionResult(response) {
  const result = response && response.result;

  if (!result || typeof result !== "object") {
    throw createUnknownError();
  }

  if (result.ok === true) {
    return result.data;
  }

  if (result.ok === false && result.error) {
    throw createClientError(normalizeBackendError(result.error));
  }

  throw createUnknownError();
}

function createCloudFunctionClient(cloud) {
  return {
    call(name, data) {
      return new Promise((resolve, reject) => {
        cloud.callFunction({
          name,
          data,
          success(response) {
            try {
              resolve(unwrapCloudFunctionResult(response));
            } catch (error) {
              reject(error);
            }
          },
          fail(error) {
            reject(createNetworkError(error));
          },
        });
      });
    },
  };
}

function createFriendlyErrorMessage(error) {
  if (error && error.code === "MODEL_NOT_CONFIGURED") {
    return "调研模型未配置，请检查云函数环境变量。";
  }

  if (error && error.code === "MODEL_AUTH_FAILED") {
    return "模型鉴权失败，请检查 API Key。";
  }

  if (error && error.type === "validation") {
    return error.message || "输入信息不完整，请修改后重试。";
  }

  if (error && error.type === "network") {
    return "网络连接失败，请稍后重试。";
  }

  return (error && error.message) || "服务暂时不可用，请稍后重试。";
}

module.exports = {
  createCloudFunctionClient,
  createFriendlyErrorMessage,
};
