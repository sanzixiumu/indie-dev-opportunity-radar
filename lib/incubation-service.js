function createQuestion(questionId, title, description, type, options) {
  return {
    questionId,
    title,
    description,
    type,
    options,
    allowCustomInput: true,
    isRequired: true
  };
}

function createQuestionsForIdea(idea) {
  const normalizedIdea = idea.trim();
  const isBusinessTool = /报价|客户|企业|SaaS|管理/.test(normalizedIdea);
  const isContentTool = /小红书|内容|选题|创作者/.test(normalizedIdea);

  const audienceOptions = isContentTool
    ? ["内容创作者", "自媒体团队", "品牌运营", "知识博主"]
    : ["个人开发者", "自由职业者", "小团队", "企业客户"];

  const platformOptions = isBusinessTool
    ? ["Web 工具", "SaaS", "微信小程序", "企业微信应用"]
    : ["微信小程序", "Web 工具", "浏览器插件", "AI Agent"];

  return [
    createQuestion(
      "target-user",
      "你最想先服务哪类用户？",
      "先锁定第一批用户，后面的竞品调研和切入建议才会更准确。",
      "single",
      audienceOptions
    ),
    createQuestion(
      "core-problem",
      "这个想法最想解决的核心问题是什么？",
      "请选出你最看重的痛点，也可以补充具体场景。",
      "multiple",
      ["节省时间", "降低成本", "提升转化", "减少重复劳动", "辅助决策"]
    ),
    createQuestion(
      "platform",
      "你更希望先做成哪种产品形态？",
      "产品形态会影响头部产品范围、开发成本和获客方式。",
      "single",
      platformOptions
    ),
    createQuestion(
      "resources",
      "你现在有哪些可用资源？",
      "AI 会根据资源判断更现实的切入优势。",
      "multiple",
      ["前端开发", "后端开发", "AI 应用开发", "设计能力", "运营渠道", "行业资源"]
    ),
    createQuestion(
      "business-model",
      "你更倾向哪种变现方式？",
      "变现方式会影响推荐切入方向和风险判断。",
      "single",
      ["订阅", "单次付费", "企业版", "服务交付", "暂不确定"]
    ),
    createQuestion(
      "risk",
      "哪些风险你最不能接受？",
      "AI 会在结果里标注风险和来源，避免只给乐观建议。",
      "multiple",
      ["开发周期长", "获客难", "竞品太强", "平台政策依赖", "付费意愿弱", "合规风险"]
    )
  ];
}

function createIncubationSession(idea) {
  return {
    idea: idea.trim(),
    questions: createQuestionsForIdea(idea),
    answers: [],
    currentQuestionIndex: 0
  };
}

function getCurrentQuestion(session) {
  return session.questions[session.currentQuestionIndex] || null;
}

function answerCurrentQuestion(session, answer) {
  const question = getCurrentQuestion(session);

  if (!question) {
    return session;
  }

  const nextAnswer = {
    questionId: question.questionId,
    questionTitle: question.title,
    selectedOptions: answer.selectedOptions || [],
    customInput: answer.customInput || ""
  };

  return Object.assign({}, session, {
    answers: session.answers.concat(nextAnswer),
    currentQuestionIndex: session.currentQuestionIndex + 1
  });
}

function goToPreviousQuestion(session) {
  if (session.currentQuestionIndex <= 0) {
    return session;
  }

  return Object.assign({}, session, {
    answers: session.answers.slice(0, -1),
    currentQuestionIndex: session.currentQuestionIndex - 1
  });
}

function canStartResearch(session) {
  return session.currentQuestionIndex >= session.questions.length;
}

function createProduct(name, positioning, strengths, weaknesses) {
  return {
    name,
    positioning,
    strengths,
    weaknesses
  };
}

function generateProjectResult(session) {
  const now = new Date().toISOString();
  const slug = String(Date.now());

  return {
    id: "project-" + slug,
    sourceIdea: session.idea,
    answers: session.answers,
    title: "AI 驱动的细分场景效率工具",
    conclusion: "建议做，但需要从明确人群和高频任务切入，避免一开始做成泛用平台。",
    domesticProducts: [
      createProduct("扣子", "AI Bot 与工作流搭建平台", "生态完善，上手快", "面向通用场景，细分行业深度不足"),
      createProduct("通义效率", "办公与内容生产 AI 工具", "模型能力强，品牌信任高", "独立开发者难以正面竞争"),
      createProduct("飞书多维表格", "团队协作与数据管理工具", "协作能力成熟，模板丰富", "轻量个人场景路径较重")
    ],
    globalProducts: [
      createProduct("Notion AI", "知识管理与 AI 写作助手", "用户基础大，工作流自然", "垂直项目决策深度有限"),
      createProduct("Airtable", "低代码数据与流程平台", "结构化能力强，生态丰富", "中文本地化和轻量用户门槛较高"),
      createProduct("Trello", "项目管理看板工具", "简单直观，适合轻协作", "AI 分析和商业判断能力弱")
    ],
    entryDirection: "先做一个聚焦单一人群的轻量决策助手，用 AI 把输入想法转成可验证的行动清单。",
    advantages: ["可以避开大平台的通用能力竞争", "小程序形态适合低门槛分享", "适合用内容渠道获取种子用户"],
    risks: [
      {
        description: "通用 AI 平台可能快速覆盖基础生成能力。",
        source: "国内外头部 AI 工作流产品都在扩展模板和插件生态。"
      },
      {
        description: "用户可能愿意试用，但不一定持续付费。",
        source: "效率工具常见风险是使用频次不足和付费意愿弱。"
      }
    ],
    suggestions: ["先做 1 个高频场景闭环", "访谈 5-10 个目标用户", "用落地页验证是否有人愿意留下联系方式"],
    createdAt: now,
    favoriteStatus: false,
    compareStatus: false
  };
}

module.exports = {
  createIncubationSession,
  getCurrentQuestion,
  answerCurrentQuestion,
  goToPreviousQuestion,
  canStartResearch,
  generateProjectResult
};
