const { appError } = require("./response");
const { normalizeGeneratedProjectDraft } = require("./validators/incubation");

function authenticationError() {
  return appError("UNAUTHENTICATED", "authentication", "未获取到用户身份", "login");
}

function mapModelInfoToDocument(modelInfo) {
  return {
    reasoning_provider: modelInfo.reasoningProvider,
    reasoning_model: modelInfo.reasoningModel,
    research_provider: modelInfo.researchProvider,
    research_model: modelInfo.researchModel,
  };
}

function mapModelInfoToProject(modelInfo = {}) {
  return {
    reasoningProvider: modelInfo.reasoning_provider,
    reasoningModel: modelInfo.reasoning_model,
    researchProvider: modelInfo.research_provider,
    researchModel: modelInfo.research_model,
  };
}

function mapProjectToDocument({ project, assetId, openid, userId, now }) {
  const normalizedProject = normalizeGeneratedProjectDraft(project);
  const timestamp = now();

  return {
    asset_id: assetId,
    asset_type: "incubated_project",
    owner_openid: openid,
    owner_user_id: userId,
    status: "active",
    source_idea: normalizedProject.sourceIdea,
    answers: normalizedProject.answers,
    title: normalizedProject.title,
    conclusion: normalizedProject.conclusion,
    limited_info: normalizedProject.limitedInfo,
    limited_info_reason: normalizedProject.limitedInfoReason,
    domestic_products: normalizedProject.domesticProducts,
    global_products: normalizedProject.globalProducts,
    entry_direction: normalizedProject.entryDirection,
    advantages: normalizedProject.advantages,
    risks: normalizedProject.risks,
    suggestions: normalizedProject.suggestions,
    research_sources: normalizedProject.researchSources,
    model_info: mapModelInfoToDocument(normalizedProject.modelInfo),
    favorite_status: normalizedProject.favoriteStatus,
    compare_status: normalizedProject.compareStatus,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function mapDocumentToProject(doc) {
  return {
    id: doc.asset_id || doc._id,
    sourceIdea: doc.source_idea,
    answers: doc.answers || [],
    title: doc.title,
    conclusion: doc.conclusion,
    limitedInfo: doc.limited_info,
    limitedInfoReason: doc.limited_info_reason,
    domesticProducts: doc.domestic_products || [],
    globalProducts: doc.global_products || [],
    entryDirection: doc.entry_direction,
    advantages: doc.advantages || [],
    risks: doc.risks || [],
    suggestions: doc.suggestions || [],
    researchSources: doc.research_sources || [],
    modelInfo: mapModelInfoToProject(doc.model_info),
    createdAt: doc.created_at,
    favoriteStatus: doc.favorite_status === true,
    compareStatus: doc.compare_status === true,
  };
}

function normalizePage(value) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function normalizePageSize(value) {
  const pageSize = Number.parseInt(value, 10);
  return Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20;
}

function createGeneratedProjectRepository({ db, now, createId }) {
  const collection = () => db.collection("generated_assets");

  async function saveProject({ openid, userId, project }) {
    if (!openid) {
      throw authenticationError();
    }

    const doc = mapProjectToDocument({
      project,
      assetId: createId(),
      openid,
      userId,
      now,
    });

    try {
      await collection().add({ data: doc });
    } catch (_error) {
      throw appError("DATABASE_WRITE_FAILED", "database", "保存项目失败，请稍后重试", "retry");
    }

    return mapDocumentToProject(doc);
  }

  async function listProjects({ openid, assetId, page, pageSize } = {}) {
    if (!openid) {
      throw authenticationError();
    }

    const normalizedPage = normalizePage(page);
    const normalizedPageSize = normalizePageSize(pageSize);
    const query = {
      owner_openid: openid,
      asset_type: "incubated_project",
      status: "active",
    };

    if (assetId) {
      query.asset_id = assetId;
    }

    const queryBuilder = collection().where(query);
    const countResult = await queryBuilder.count();
    const total = countResult.total || 0;

    const result = await queryBuilder
      .orderBy("created_at", "desc")
      .skip((normalizedPage - 1) * normalizedPageSize)
      .limit(normalizedPageSize)
      .get();

    if (assetId && (!result.data || result.data.length === 0)) {
      throw appError("NOT_FOUND", "permission", "项目不存在或无权访问", "retry");
    }

    return {
      items: (result.data || []).map(mapDocumentToProject),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
    };
  }

  return {
    saveProject,
    listProjects,
  };
}

module.exports = {
  createGeneratedProjectRepository,
  mapDocumentToProject,
  mapProjectToDocument,
};
