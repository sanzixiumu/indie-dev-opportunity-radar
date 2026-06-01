const {
  appError,
  createRequestId,
  normalizeError,
  okResponse,
} = require("./_shared/response");

function authenticationError() {
  return appError("UNAUTHENTICATED", "authentication", "未获取到用户身份", "login");
}

/**
 * @typedef {{
 *   listProjects(options: {
 *     openid: string,
 *     assetId: unknown,
 *     page: unknown,
 *     pageSize: unknown
 *   }): Promise<unknown>
 * }} GeneratedProjectRepository
 *
 * @typedef {{
 *   getWXContext(): { OPENID?: string },
 *   repo: GeneratedProjectRepository,
 *   now(): string
 * }} ListGeneratedProjectsDeps
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {ListGeneratedProjectsDeps} deps
 */
function createListGeneratedProjects({ getWXContext, repo, now }) {
  return async (event, _context) => {
    const requestId = createRequestId(now);

    try {
      const wxContext = getWXContext();
      if (!wxContext.OPENID) {
        throw authenticationError();
      }

      const payload = isRecord(event) ? event : {};
      const result = await repo.listProjects({
        openid: wxContext.OPENID,
        assetId: payload.asset_id,
        page: payload.page,
        pageSize: payload.page_size,
      });

      return okResponse(result, requestId);
    } catch (error) {
      return normalizeError(error, requestId);
    }
  };
}

module.exports = {
  createListGeneratedProjects,
};
