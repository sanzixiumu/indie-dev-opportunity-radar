const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const { callModel, createAiGateway } = require("../../cloudfunctions/_shared/ai-gateway");
const callDeepseek = require("../../cloudfunctions/_shared/ai-gateway/providers/deepseek");
const callDoubao = require("../../cloudfunctions/_shared/ai-gateway/providers/doubao");

test("module exports convenience callModel function", () => {
  assert.equal(typeof callModel, "function");
});

test("reasoning task routes to deepseek defaults from env", async () => {
  const calls = [];
  const gateway = createAiGateway({
    env: {
      DEEPSEEK_API_KEY: "deepseek-key"
    },
    providers: {
      deepseek: async (config) => {
        calls.push(config);
        return { provider: "deepseek", model: config.model, text: "ok" };
      }
    }
  });

  const result = await gateway.callModel({
    taskType: "reasoning",
    messages: [{ role: "user", content: "Think" }],
    requestId: "req_reasoning"
  });

  assert.deepEqual(result, {
    provider: "deepseek",
    model: "deepseek-v4-pro",
    text: "ok"
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, "deepseek");
  assert.equal(calls[0].model, "deepseek-v4-pro");
  assert.equal(calls[0].apiKey, "deepseek-key");
  assert.equal(calls[0].baseUrl, "https://api.deepseek.com");
  assert.deepEqual(calls[0].messages, [{ role: "user", content: "Think" }]);
});

test("web_research routes to doubao defaults and injects web_search tools", async () => {
  const calls = [];
  const gateway = createAiGateway({
    env: {
      AI_WEB_RESEARCH_MODEL: "doubao-search",
      ARK_API_KEY: "ark-key"
    },
    providers: {
      doubao: async (config) => {
        calls.push(config);
        return {
          provider: "doubao",
          model: config.model,
          text: "research",
          tools: config.tools
        };
      }
    }
  });

  const result = await gateway.callModel({
    taskType: "web_research",
    messages: [{ role: "user", content: "Search" }],
    requestId: "req_search"
  });

  assert.deepEqual(result, {
    provider: "doubao",
    model: "doubao-search",
    text: "research",
    tools: [{ type: "web_search" }]
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, "doubao");
  assert.equal(calls[0].model, "doubao-search");
  assert.equal(calls[0].apiKey, "ark-key");
  assert.equal(calls[0].baseUrl, "https://ark.cn-beijing.volces.com/api/v3");
  assert.deepEqual(calls[0].tools, [{ type: "web_search" }]);
});

test("missing web research model throws model configuration error", async () => {
  const gateway = createAiGateway({
    env: {
      ARK_API_KEY: "ark-key"
    },
    providers: {
      doubao: async () => ({ text: "unused" })
    }
  });

  await assert.rejects(
    gateway.callModel({
      taskType: "web_research",
      messages: [{ role: "user", content: "Search" }],
      requestId: "req_missing_model"
    }),
    (error) => {
      assert.equal(error.code, "MODEL_NOT_CONFIGURED");
      assert.equal(error.type, "configuration");
      assert.equal(error.action, "configure_model");
      return true;
    }
  );
});

test("provider and model override still requires provider API key", async () => {
  let providerCalled = false;
  const gateway = createAiGateway({
    env: {
      DEEPSEEK_API_KEY: "deepseek-key"
    },
    providers: {
      doubao: async () => {
        providerCalled = true;
        return { text: "unused" };
      }
    }
  });

  await assert.rejects(
    gateway.callModel({
      taskType: "reasoning",
      provider: "doubao",
      model: "doubao-search",
      messages: [{ role: "user", content: "Search" }],
      requestId: "req_override_missing_key"
    }),
    (error) => {
      assert.equal(error.code, "MODEL_NOT_CONFIGURED");
      assert.equal(error.type, "configuration");
      assert.equal(error.action, "configure_model");
      return true;
    }
  );
  assert.equal(providerCalled, false);
});

test("reasoning provider env override resolves doubao credentials", async () => {
  const calls = [];
  const gateway = createAiGateway({
    env: {
      AI_REASONING_PROVIDER: "doubao",
      AI_REASONING_MODEL: "doubao-reasoning",
      ARK_API_KEY: "ark-key",
      ARK_BASE_URL: "https://ark.example.test/api/v3",
      DEEPSEEK_API_KEY: "wrong-key",
      DEEPSEEK_BASE_URL: "https://wrong.example.test"
    },
    providers: {
      doubao: async (config) => {
        calls.push(config);
        return { provider: "doubao", model: config.model, text: "ok" };
      }
    }
  });

  const result = await gateway.callModel({
    taskType: "reasoning",
    messages: [{ role: "user", content: "Think" }],
    requestId: "req_reasoning_doubao"
  });

  assert.deepEqual(result, {
    provider: "doubao",
    model: "doubao-reasoning",
    text: "ok"
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, "doubao");
  assert.equal(calls[0].apiKey, "ark-key");
  assert.equal(calls[0].baseUrl, "https://ark.example.test/api/v3");
});

test("web research provider env override resolves deepseek credentials", async () => {
  const calls = [];
  const gateway = createAiGateway({
    env: {
      AI_WEB_RESEARCH_PROVIDER: "deepseek",
      AI_WEB_RESEARCH_MODEL: "deepseek-search",
      DEEPSEEK_API_KEY: "deepseek-key",
      DEEPSEEK_BASE_URL: "https://deepseek.example.test",
      ARK_API_KEY: "wrong-key",
      ARK_BASE_URL: "https://wrong.example.test"
    },
    providers: {
      deepseek: async (config) => {
        calls.push(config);
        return { provider: "deepseek", model: config.model, text: "research" };
      }
    }
  });

  const result = await gateway.callModel({
    taskType: "web_research",
    messages: [{ role: "user", content: "Search" }],
    requestId: "req_research_deepseek"
  });

  assert.deepEqual(result, {
    provider: "deepseek",
    model: "deepseek-search",
    text: "research"
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, "deepseek");
  assert.equal(calls[0].apiKey, "deepseek-key");
  assert.equal(calls[0].baseUrl, "https://deepseek.example.test");
});

test("doubao maps responseFormat to responses text format payload", async () => {
  const postCalls = [];

  await withMockedAxios({
    post: async (...args) => {
      postCalls.push(args);
      return {
        data: {
          output: [{
            type: "message",
            content: [{ type: "output_text", text: "{\"ok\":true}" }]
          }]
        }
      };
    }
  }, async () => {
    const result = await callDoubao({
      baseUrl: "https://ark.example.test/api/v3",
      apiKey: "ark-key",
      model: "doubao-search",
      messages: [{ role: "user", content: "Return JSON" }],
      responseFormat: { type: "json_object" },
      temperature: 0.2,
      requestId: "req_doubao_json"
    });

    assert.equal(result.text, "{\"ok\":true}");
  });

  assert.equal(postCalls.length, 1);
  assert.equal(postCalls[0][0], "https://ark.example.test/api/v3/responses");
  assert.deepEqual(postCalls[0][1], {
    model: "doubao-search",
    input: [{ role: "user", content: "Return JSON" }],
    tools: [{ type: "web_search" }],
    temperature: 0.2,
    text: {
      format: { type: "json_object" }
    }
  });
  assert.equal(postCalls[0][2].headers.Authorization, "Bearer ark-key");
  assert.equal(postCalls[0][2].headers["X-Request-Id"], "req_doubao_json");
});

test("doubao extracts only final message output text", async () => {
  await withMockedAxios({
    post: async () => ({
      data: {
        output_text: "ignore top-level text",
        output: [
          {
            type: "reasoning",
            content: [{ type: "output_text", text: "ignore reasoning" }]
          },
          {
            type: "tool_call",
            content: [{ type: "output_text", text: "ignore tool" }]
          },
          {
            type: "message",
            content: [
              { type: "reasoning_text", text: "ignore message reasoning" },
              { type: "output_text", text: "Final " },
              { type: "output_text", text: "answer" }
            ]
          }
        ]
      }
    })
  }, async () => {
    const result = await callDoubao({
      baseUrl: "https://ark.example.test/api/v3",
      apiKey: "ark-key",
      model: "doubao-search",
      messages: [{ role: "user", content: "Search" }],
      requestId: "req_doubao_extract"
    });

    assert.equal(result.text, "Final answer");
  });
});

test("deepseek sends chat completions payload and headers", async () => {
  const postCalls = [];

  await withMockedAxios({
    post: async (...args) => {
      postCalls.push(args);
      return {
        data: {
          choices: [{
            message: { content: "{\"ok\":true}" }
          }]
        }
      };
    }
  }, async () => {
    const result = await callDeepseek({
      baseUrl: "https://deepseek.example.test",
      apiKey: "deepseek-key",
      model: "deepseek-chat",
      messages: [{ role: "user", content: "Return JSON" }],
      responseFormat: { type: "json_object" },
      temperature: 0.3,
      requestId: "req_deepseek_json"
    });

    assert.equal(result.text, "{\"ok\":true}");
  });

  assert.equal(postCalls.length, 1);
  assert.equal(postCalls[0][0], "https://deepseek.example.test/chat/completions");
  assert.deepEqual(postCalls[0][1], {
    model: "deepseek-chat",
    messages: [{ role: "user", content: "Return JSON" }],
    response_format: { type: "json_object" },
    temperature: 0.3
  });
  assert.equal(postCalls[0][2].headers.Authorization, "Bearer deepseek-key");
  assert.equal(postCalls[0][2].headers["X-Request-Id"], "req_deepseek_json");
});

test("deepseek maps auth failures to model auth error", async () => {
  await withMockedAxios({
    post: async () => {
      const error = new Error("unauthorized");
      error.response = { status: 401 };
      throw error;
    }
  }, async () => {
    await assert.rejects(
      callDeepseek({
        baseUrl: "https://deepseek.example.test",
        apiKey: "bad-key",
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Return JSON" }],
        requestId: "req_deepseek_auth"
      }),
      (error) => {
        assert.equal(error.code, "MODEL_AUTH_FAILED");
        assert.equal(error.type, "authentication");
        assert.equal(error.action, "configure_model");
        return true;
      }
    );
  });
});

async function withMockedAxios(axiosExports, callback) {
  const originalLoad = Module._load;

  Module._load = function loadMockedAxios(request, parent, isMain) {
    if (request === "axios") {
      return axiosExports;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    await callback();
  } finally {
    Module._load = originalLoad;
  }
}
