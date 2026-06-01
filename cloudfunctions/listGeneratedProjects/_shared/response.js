const UNKNOWN_ERROR = {
  code: "UNKNOWN_ERROR",
  type: "unknown",
  message: "服务暂时不可用，请稍后再试",
  action: "contact_support"
};

const APP_ERROR_MARKER = Symbol("appError");

const KNOWN_ERROR_TYPES = new Set([
  "configuration",
  "authentication",
  "auth",
  "validation",
  "quota",
  "ai_generation",
  "ai_output",
  "database",
  "permission",
  "network",
  "unknown"
]);

/**
 * @typedef {{
 *   code: string,
 *   type: string,
 *   message: string,
 *   action: string
 * }} NormalizedError
 */

/**
 * @param {() => string} now
 */
function createRequestId(now) {
  return `req_${now().replace(/[-:.TZ]/g, "")}`;
}

/**
 * @template T
 * @param {T} data
 * @param {string} requestId
 */
function okResponse(data, requestId) {
  return {
    ok: true,
    data,
    request_id: requestId
  };
}

/**
 * @param {NormalizedError & { requestId: string }} details
 */
function errorResponse({ code, type, message, action, requestId }) {
  return {
    ok: false,
    error: {
      code,
      type: normalizeErrorType(type),
      message,
      action
    },
    request_id: requestId
  };
}

/**
 * @param {string} code
 * @param {string} type
 * @param {string} message
 * @param {string} action
 */
function appError(code, type, message, action) {
  const error = new Error(message);
  error.code = code;
  error.type = type;
  error.action = action;
  error.isAppError = true;
  error[APP_ERROR_MARKER] = true;
  return error;
}

/**
 * @param {unknown} type
 */
function normalizeErrorType(type) {
  return KNOWN_ERROR_TYPES.has(type) ? type : "unknown";
}

/**
 * @param {unknown} error
 * @param {string} requestId
 */
function normalizeError(error, requestId) {
  let normalizedError = { ...UNKNOWN_ERROR };

  if (error && typeof error === "object" && error[APP_ERROR_MARKER] === true) {
    normalizedError = {
      code: error.code,
      type: normalizeErrorType(error.type),
      message: error.message,
      action: error.action
    };
  }

  return errorResponse({ ...normalizedError, requestId });
}

module.exports = {
  appError,
  createRequestId,
  errorResponse,
  normalizeError,
  okResponse
};
