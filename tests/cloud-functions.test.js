const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createCloudFunctionClient,
  createFriendlyErrorMessage,
} = require("../lib/cloud-functions");

test("call unwraps successful cloud function data", async () => {
  const cloud = {
    callFunction({ name, data, success }) {
      assert.equal(name, "generateIncubationAnalysis");
      assert.deepEqual(data, { idea: "AI 选题工具" });
      success({
        result: {
          ok: true,
          data: { title: "AI 驱动的效率工具" },
        },
      });
    },
  };
  const client = createCloudFunctionClient(cloud);

  const result = await client.call("generateIncubationAnalysis", {
    idea: "AI 选题工具",
  });

  assert.deepEqual(result, { title: "AI 驱动的效率工具" });
});

test("call rejects typed backend errors with details", async () => {
  const cloud = {
    callFunction({ success }) {
      success({
        result: {
          ok: false,
          error: {
            code: "MODEL_AUTH_FAILED",
            type: "authentication",
            action: "configure_api_key",
            message: "API Key 无效",
          },
        },
      });
    },
  };
  const client = createCloudFunctionClient(cloud);

  await assert.rejects(client.call("createIncubationQuestions", {}), (error) => {
    assert.equal(error.code, "MODEL_AUTH_FAILED");
    assert.equal(error.type, "authentication");
    assert.equal(error.action, "configure_api_key");
    assert.equal(error.message, "API Key 无效");
    return true;
  });
});

test("createFriendlyErrorMessage explains unconfigured model errors", () => {
  const message = createFriendlyErrorMessage({
    code: "MODEL_NOT_CONFIGURED",
    type: "configuration",
    action: "configure_model",
    message: "missing env",
  });

  assert.equal(message, "调研模型未配置，请检查云函数环境变量。");
});

test("call rejects cloud function failures as retryable network errors", async () => {
  const cloud = {
    callFunction({ fail }) {
      fail({ errMsg: "request:fail timeout" });
    },
  };
  const client = createCloudFunctionClient(cloud);

  await assert.rejects(client.call("listGeneratedProjects", {}), (error) => {
    assert.equal(error.code, "NETWORK_ERROR");
    assert.equal(error.type, "network");
    assert.equal(error.action, "retry");
    assert.equal(error.message, "request:fail timeout");
    return true;
  });
});
