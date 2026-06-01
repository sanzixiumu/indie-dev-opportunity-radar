# Tab1 灵感孵化与工作台后端闭环设计

日期：2026-06-01

## 背景

Tab1 已从传统画像问卷调整为“灵感孵化”：用户输入一个项目想法，AI 动态追问关键信息，信息足够后进行市场调研和方向分析，最终由用户确认保存到工作台。

当前项目已经完成用户身份云函数 `getUserContext`。下一步需要把 Tab1 的灵感孵化和 Tab4 工作台打成真实后端闭环：追问、联网调研、结构化分析、保存结果、工作台读取都通过 CloudBase 云函数完成。

## 目标

- 用真实模型完成灵感追问和市场调研分析。
- 通过统一模型网关封装 DeepSeek、豆包和后续其他模型。
- 当前内部默认使用 DeepSeek V4 做推理，使用豆包/火山方舟可联网模型做联网调研。
- 将用户确认的孵化结果保存到 `generated_assets`，并绑定当前用户身份。
- 工作台读取当前用户自己的已生成项目，并展示和 Tab1 最终结果一致的详情。
- 所有后端失败都返回类型化错误，前端可以据此显示准确提示。

## 非目标

- 本阶段不做页面上的模型选择 UI。
- 本阶段不实现 PRD 生成、项目对比、收藏状态变更的完整后端动作。
- 本阶段不做独立 HTTP API、CloudRun 长任务或流式进度。
- 本阶段不把未确认的调研结果自动保存到工作台。

## 整体架构

Tab1 和 Tab4 都通过 CloudBase Event Function 访问后端。前端不传可信 `openid`，所有用户身份从 `cloud.getWXContext()` 获取。

```text
Tab1 idea
  -> createIncubationQuestions
  -> AI Gateway taskType=reasoning
  -> DeepSeek V4 生成动态追问
  -> 前端收集 answers
  -> generateIncubationAnalysis
  -> AI Gateway taskType=web_research
  -> 豆包 web_search 生成结构化调研结果
  -> 用户点击确定方向
  -> saveGeneratedProject
  -> generated_assets
  -> Tab4 listGeneratedProjects
  -> 工作台列表和详情
```

生成分析和保存方向分开。`generateIncubationAnalysis` 只返回结果，不写入正式资产；`saveGeneratedProject` 在用户点击“确定方向”后写入 `generated_assets`。这样可以避免用户试跑分析时污染工作台。

## 模型网关设计

新增共享模块：`cloudfunctions/_shared/ai-gateway/`。

模型网关对业务云函数暴露统一接口：

```js
callModel({
  taskType: "reasoning" | "web_research",
  provider,
  model,
  messages,
  responseFormat,
  tools,
  temperature,
  requestId
});
```

默认路由：

- `reasoning`：`AI_REASONING_PROVIDER=deepseek`，`AI_REASONING_MODEL=deepseek-v4-pro`。
- `web_research`：`AI_WEB_RESEARCH_PROVIDER=doubao`，`AI_WEB_RESEARCH_MODEL` 使用支持 `web_search` 的豆包/火山方舟模型。
- 保留 `AI_PROVIDER` 和 `AI_MODEL` 作为旧配置兜底。

业务层只传任务类型，不直接调用具体供应商 SDK。未来页面如果要配置模型，可以把 `provider` 和 `model` 作为可选覆盖参数传入云函数，再由后端做白名单校验。

DeepSeek V4 API 不假设自带联网搜索。它用于追问、总结和结构化推理。豆包联网调研通过火山方舟 Responses API 的 `web_search` 工具完成。

## 环境变量

`.env.example` 和本地 `.env` 需要增加以下占位和注释。真实 Key 不提交，用户自行填写本地 `.env` 和云函数环境变量。
这里的空值是刻意保留给本地和云端部署配置的密钥位，不是未完成设计项。

```env
# =========================
# AI Task Routing
# =========================

# Reasoning model used for structured thinking, follow-up questions, summaries.
AI_REASONING_PROVIDER=deepseek
AI_REASONING_MODEL=deepseek-v4-pro

# Web research model used for product/company search and market evidence.
# Fill with a Volcengine Ark / Doubao model that supports Responses API web_search.
AI_WEB_RESEARCH_PROVIDER=doubao
AI_WEB_RESEARCH_MODEL=

# DeepSeek V4.
# Used by taskType=reasoning.
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Volcengine Ark / Doubao.
# Used by taskType=web_research.
ARK_API_KEY=
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

## 新增云函数

### createIncubationQuestions

输入：

```js
{
  idea: string,
  provider?: string,
  model?: string
}
```

行为：

- 校验 `idea` 非空。
- 调用模型网关 `taskType=reasoning`。
- 使用“灵感追问提示词”生成动态问题。
- 返回 `session_id`、`initialAssessment` 和 `questions`。
- 不创建正式工作台资产。

### generateIncubationAnalysis

输入：

```js
{
  idea: string,
  answers: IncubationAnswer[],
  provider?: string,
  model?: string
}
```

行为：

- 校验 `idea` 和 `answers`。
- 调用模型网关 `taskType=web_research`。
- 启用豆包/火山方舟 `web_search`。
- 使用“调研结果提示词”生成结构化结果。
- 返回完整 `GeneratedProject` 草稿、`researchSources` 和 `modelInfo`。
- 不写入 `generated_assets`。

### saveGeneratedProject

输入：

```js
{
  project: GeneratedProjectDraft
}
```

行为：

- 从 `cloud.getWXContext()` 获取 `OPENID`。
- 查找或复用 `users` 中的当前用户记录。
- 校验项目结构。
- 写入 `generated_assets`，`asset_type` 为 `incubated_project`。
- 返回 `asset_id` 和保存后的项目。

### listGeneratedProjects

输入：

```js
{
  asset_type?: "incubated_project",
  asset_id?: string,
  page?: number,
  page_size?: number
}
```

行为：

- 只返回当前 `OPENID` 拥有的资产。
- 不重新调用模型。
- `asset_id` 存在时返回单个详情；否则分页返回列表。
- Tab1 最近孵化和 Tab4 工作台共用这个函数。

## 数据结构

数据库集合：`generated_assets`。

数据库字段使用蛇形命名：

```js
{
  asset_id: "asset_xxx",
  asset_type: "incubated_project",
  owner_openid: "openid_xxx",
  owner_user_id: "user_xxx",

  source_idea: "...",
  answers: [],

  title: "...",
  conclusion: "...",
  limited_info: false,
  limited_info_reason: "",
  domestic_products: [],
  global_products: [],
  entry_direction: "...",
  advantages: [],
  risks: [],
  suggestions: [],
  research_sources: [],

  model_info: {
    reasoning_provider: "deepseek",
    reasoning_model: "deepseek-v4-pro",
    research_provider: "doubao",
    research_model: "..."
  },

  favorite_status: false,
  compare_status: false,
  status: "active",
  created_at: "...",
  updated_at: "..."
}
```

云函数返回给前端时映射为驼峰命名：

```ts
type GeneratedProject = {
  id: string;
  sourceIdea: string;
  answers: IncubationAnswer[];
  title: string;
  conclusion: string;
  limitedInfo: boolean;
  limitedInfoReason: string;
  domesticProducts: ProductResearchItem[];
  globalProducts: ProductResearchItem[];
  entryDirection: string;
  advantages: string[];
  risks: RiskItem[];
  suggestions: SuggestionItem[];
  researchSources: ResearchSource[];
  modelInfo: ModelInfo;
  favoriteStatus: boolean;
  compareStatus: boolean;
  createdAt: string;
};
```

## 类型化错误

所有云函数失败都返回统一结构：

```js
{
  ok: false,
  error: {
    code: "MODEL_NOT_CONFIGURED",
    type: "configuration",
    message: "调研模型未配置",
    action: "configure_model"
  },
  request_id: "req_xxx"
}
```

错误类型：

- `configuration`：环境变量、模型名称或工具配置缺失。
- `authentication`：模型 Key 无效，或小程序身份不可用。
- `validation`：用户输入或请求结构错误。
- `quota`：额度不足。
- `ai_generation`：模型调用失败。
- `ai_output`：模型输出无法解析或结构不合规。
- `database`：数据库读写失败。
- `permission`：访问不属于自己的资产。
- `network`：外部接口网络失败。
- `unknown`：未分类异常。

核心错误码：

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `MODEL_NOT_CONFIGURED`
- `MODEL_AUTH_FAILED`
- `AI_GENERATION_FAILED`
- `AI_OUTPUT_INVALID`
- `WEB_SEARCH_UNAVAILABLE`
- `DATABASE_WRITE_FAILED`
- `FORBIDDEN`
- `NOT_FOUND`

前端优先按 `action` 做通用提示，再按 `code` 处理页面级细节。

## 提示词 1：灵感追问

用途：DeepSeek V4，`taskType=reasoning`。根据用户灵感生成动态追问，不做最终市场结论。

```text
你是一个面向独立开发者的项目方向孵化顾问。你的任务是根据用户输入的项目灵感，判断为了做后续市场调研和方向分析，还缺少哪些关键信息，并生成适合移动端回答的追问问题。

要求：
1. 只输出 JSON，不要输出 Markdown、解释文本或代码块。
2. 问题数量控制在 4-6 个；如果用户灵感已经非常完整，可以少于 4 个。
3. 问题必须帮助判断：目标用户、核心痛点、使用场景、用户资源、技术/运营能力、变现偏好、风险边界、期望结果。
4. 每个问题必须适合手机端选择，标题简短，说明不超过 40 个中文字符。
5. 选项应具体、互斥或可组合，不要使用空泛选项。
6. 如果问题允许自由补充，设置 allowCustomInput=true。
7. 不要生成最终项目结论、竞品分析或市场判断。
8. 如果用户输入过短或含糊，也要给出可以帮助澄清方向的问题。

用户灵感：
{{idea}}

请严格按以下 JSON 结构输出：

{
  "initialAssessment": {
    "summary": "用一句话复述你理解的项目灵感",
    "missingInfo": ["缺少的信息点"],
    "readyForResearch": false
  },
  "questions": [
    {
      "questionId": "q_target_user",
      "title": "问题标题",
      "description": "问题说明",
      "type": "single | multiple",
      "options": [
        { "label": "选项文案", "value": "stable_value" }
      ],
      "allowCustomInput": true,
      "isRequired": true
    }
  ]
}
```

## 提示词 2：调研结果

用途：豆包/火山方舟，`taskType=web_research`，启用 `web_search`。生成 Tab1 结果和工作台详情。

```text
你是一个严谨的独立开发项目市场研究员。你的任务是基于用户的项目灵感和追问答案，结合联网搜索结果，分析国内外相似产品，给出适合独立开发者切入的项目方向建议。

要求：
1. 只输出 JSON，不要输出 Markdown、解释文本或代码块。
2. 必须优先使用联网搜索获得的信息；不能确认的信息要标记为信息有限，不要编造事实。
3. 国内产品和国外产品各返回 3 个。如果搜索证据不足，可以少于 3 个，但必须说明 limitedInfoReason。
4. 每个产品必须包含定位、主要优势、主要短板。
5. 风险必须包含风险描述和风险来源。风险来源可以是竞品强度、平台政策、获客难度、数据来源不稳定、合规要求、付费意愿不足、技术门槛等。
6. 推荐切入方向必须结合用户资源、追问答案和竞品差异，不要给泛泛建议。
7. 建议必须是最小验证动作，按优先级排列。
8. 如果搜索结果不足以支撑强结论，conclusion 中必须明确“信息有限，需要进一步验证”。
9. researchSources 只放实际用于判断的信息来源摘要，不要放无关搜索结果。

用户灵感：
{{idea}}

用户追问答案：
{{answers_json}}

请严格按以下 JSON 结构输出：

{
  "title": "项目方向标题",
  "conclusion": "方向结论，说明建议做/需要收窄/暂不建议直接做，以及原因",
  "limitedInfo": false,
  "limitedInfoReason": "",
  "domesticProducts": [
    {
      "name": "产品名称",
      "positioning": "产品定位",
      "strengths": "主要优势",
      "weaknesses": "主要短板",
      "evidence": "用于判断的来源或搜索摘要"
    }
  ],
  "globalProducts": [
    {
      "name": "产品名称",
      "positioning": "产品定位",
      "strengths": "主要优势",
      "weaknesses": "主要短板",
      "evidence": "用于判断的来源或搜索摘要"
    }
  ],
  "entryDirection": "推荐切入方向",
  "advantages": ["用户可切入优势"],
  "risks": [
    {
      "description": "风险描述",
      "source": "风险来源"
    }
  ],
  "suggestions": [
    {
      "priority": "P0 | P1 | P2",
      "action": "下一步最小验证动作",
      "expectedSignal": "用什么信号判断是否继续"
    }
  ],
  "researchSources": [
    {
      "title": "来源标题",
      "url": "来源 URL，如无 URL 则为空字符串",
      "summary": "该来源支持了什么判断"
    }
  ]
}
```

## Tab1 页面闭环

Tab1 首页改为“灵感孵化”入口：

- 页面加载时调用 `listGeneratedProjects`，展示最近 2-3 个 `incubated_project`。
- 用户输入项目灵感后点击“开始孵化”。
- 全屏底部弹窗进入 `creating_questions` 状态。
- 追问问题来自 `createIncubationQuestions`，前端不硬编码具体题目。
- 用户完成追问后点击“开始调研市场”。
- `researching` 状态展示三步进度：查询产品、对比优劣、分析方向。
- `generateIncubationAnalysis` 成功后进入结果态。
- 结果态展示方向结论、国内产品、国外产品、推荐切入方向、可切入优势、风险、建议和调研来源。
- 用户点击“确定方向”后调用 `saveGeneratedProject`。
- 保存成功后跳转 Tab4；保存失败时留在结果态。

如果后端没有流式阶段事件，前端用本地阶段动画展示进度，但最终结果必须以后端返回为准。

## Tab4 工作台闭环

Tab4 默认展示当前用户的 `incubated_project` 列表。

列表项展示：

- 项目方向标题。
- 方向结论摘要。
- 推荐切入方向摘要。
- 风险数量。
- 生成时间。
- 模型/调研来源标记。

点击列表项打开详情。详情展示和 Tab1 结果态相同的内容，不重新调用模型、不重新扣费、不重新调研。

收藏、对比、生成 PRD 按钮可以保留入口，但本阶段不实现完整后端动作。若展示按钮，应使用禁用态或“即将支持”提示，避免造成已完成的误解。

## 测试设计

### 模型网关单元测试

- `reasoning` 默认路由到 DeepSeek。
- `web_research` 默认路由到豆包。
- 显式 `provider/model` 覆盖生效。
- 缺少 Key 或模型时返回 `MODEL_NOT_CONFIGURED`。
- 模型返回非 JSON 时触发修复或返回 `AI_OUTPUT_INVALID`。

### 云函数测试

- `createIncubationQuestions` 空 `idea` 返回 `VALIDATION_ERROR`。
- `createIncubationQuestions` 正常输入返回问题数组。
- `generateIncubationAnalysis` 非法 `answers` 返回 `VALIDATION_ERROR`。
- `generateIncubationAnalysis` 正常输入返回完整结果结构。
- `saveGeneratedProject` 未登录返回 `UNAUTHENTICATED`。
- `saveGeneratedProject` 正常保存时写入 `generated_assets` 并绑定 `owner_openid`。
- `listGeneratedProjects` 只返回当前用户资产。
- 所有失败都包含 `error.code`、`error.type`、`error.action` 和 `request_id`。

### 前端验收

- Tab1 能输入想法并打开全屏 AI 弹窗。
- 追问来自后端，前端不硬编码问题内容。
- 调研中显示三步进度。
- 结果态展示完整结构化分析。
- 豆包模型未配置时显示配置型失败提示。
- 点击“确定方向”成功保存后跳转工作台。
- 工作台能读取当前用户项目列表。
- 工作台详情展示与 Tab1 最终结果一致。
- 保存失败时不跳转，结果仍保留。
- 历史详情不重新调用模型。

## 验收标准

- DeepSeek V4 可完成动态追问生成。
- 豆包/火山方舟可联网模型可完成市场调研分析。
- 模型供应商由统一模型网关封装，业务云函数不直接散落供应商调用逻辑。
- `.env.example` 包含 DeepSeek 和豆包联网调研所需占位说明。
- `generated_assets` 能保存已确认的灵感孵化结果。
- Tab4 工作台能读取并展示当前用户保存的结果。
- 所有失败返回类型化错误，前端可以识别失败原因并显示对应提示。

## 参考

- DeepSeek API 文档：https://api-docs.deepseek.com/
- 火山方舟工具概述：https://www.volcengine.com/docs/82379/1827538
- 火山方舟 Web Search 文档：https://www.volcengine.com/docs/82379/1756990
