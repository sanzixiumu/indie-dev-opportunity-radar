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
 *   saveProject(options: {
 *     openid: string,
 *     userId: string,
 *     project: unknown
 *   }): Promise<unknown>
 * }} GeneratedProjectRepository
 *
 * @typedef {{
 *   getWXContext(): { OPENID?: string },
 *   repo: GeneratedProjectRepository,
 *   now(): string
 * }} SaveGeneratedProjectDeps
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {SaveGeneratedProjectDeps} deps
 */
function createSaveGeneratedProject({ getWXContext, repo, now }) {
  return async (event, _context) => {
    const requestId = createRequestId(now);

    try {
      const wxContext = getWXContext();
      if (!wxContext.OPENID) {
        throw authenticationError();
      }

      const payload = isRecord(event) ? event : {};
      const project = await repo.saveProject({
        openid: wxContext.OPENID,
        userId: "",
        project: payload.project,
      });

      return okResponse({ project }, requestId);
    } catch (error) {
      return normalizeError(error, requestId);
    }
  };
}

module.exports = {
  createSaveGeneratedProject,
};
