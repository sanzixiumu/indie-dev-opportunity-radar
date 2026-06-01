const assert = require("node:assert/strict");
const test = require("node:test");

const {
  appError,
  createRequestId,
  errorResponse,
  normalizeError,
  okResponse
} = require("../../cloudfunctions/_shared/response");

test("createRequestId formats compact timestamp request ids", () => {
  assert.equal(createRequestId(() => "2026-06-01T12:34:56.789Z"), "req_20260601123456789");
});

test("okResponse wraps data and request_id", () => {
  assert.deepEqual(okResponse({ value: 42 }, "req_123"), {
    ok: true,
    data: {
      value: 42
    },
    request_id: "req_123"
  });
});

test("errorResponse wraps code, type, message, action, and request_id", () => {
  assert.deepEqual(errorResponse({
    code: "UNAUTHENTICATED",
    type: "auth",
    message: "Login required",
    action: "login",
    requestId: "req_456"
  }), {
    ok: false,
    error: {
      code: "UNAUTHENTICATED",
      type: "auth",
      message: "Login required",
      action: "login"
    },
    request_id: "req_456"
  });
});

test("errorResponse normalizes unknown types", () => {
  assert.deepEqual(errorResponse({
    code: "STRANGE_ERROR",
    type: "strange",
    message: "Something strange happened",
    action: "contact_support",
    requestId: "req_strange"
  }), {
    ok: false,
    error: {
      code: "STRANGE_ERROR",
      type: "unknown",
      message: "Something strange happened",
      action: "contact_support"
    },
    request_id: "req_strange"
  });
});

test("normalizeError maps unknown Error to safe support response", () => {
  assert.deepEqual(normalizeError(new Error("database password leaked"), "req_unknown"), {
    ok: false,
    error: {
      code: "UNKNOWN_ERROR",
      type: "unknown",
      message: "服务暂时不可用，请稍后再试",
      action: "contact_support"
    },
    request_id: "req_unknown"
  });
});

test("normalizeError maps appError signature to response shape", () => {
  const error = appError("VALIDATION_FAILED", "validation", "Name is required", "fix_input");

  assert.deepEqual(normalizeError(error, "req_app"), {
    ok: false,
    error: {
      code: "VALIDATION_FAILED",
      type: "validation",
      message: "Name is required",
      action: "fix_input"
    },
    request_id: "req_app"
  });
});

test("normalizeError rejects spoofed app error objects", () => {
  assert.deepEqual(
    normalizeError({
      code: "VALIDATION_FAILED",
      type: "validation",
      message: "sensitive internal validation detail",
      action: "fix_input",
      isAppError: true
    }, "req_spoofed"),
    {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        type: "unknown",
        message: "服务暂时不可用，请稍后再试",
        action: "contact_support"
      },
      request_id: "req_spoofed"
    }
  );
});

test("normalizeError maps app errors with unknown types to unknown", () => {
  const error = appError("WEIRD_ERROR", "weird", "Unexpected typed failure", "contact_support");

  assert.deepEqual(normalizeError(error, "req_weird"), {
    ok: false,
    error: {
      code: "WEIRD_ERROR",
      type: "unknown",
      message: "Unexpected typed failure",
      action: "contact_support"
    },
    request_id: "req_weird"
  });
});
