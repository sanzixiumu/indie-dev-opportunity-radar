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
 *   resolveUserId(openid: string): Promise<string>,
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
 * @param {{ db: { collection(name: "users"): unknown }, now(): string, createId(): string }} deps
 */
function createUserResolver({ db, now, createId }) {
  return async function resolveUserId(openid) {
    const users = db.collection("users");
    const existing = await users.where({ openid }).get();
    const user = (existing.data || [])[0];

    if (user && user.user_id) {
      return user.user_id;
    }

    const timestamp = now();
    const userId = createId();
    await users.add({
      data: {
        user_id: userId,
        openid,
        membership_type: "free",
        membership_expired_at: null,
        created_at: timestamp,
        updated_at: timestamp,
        last_login_at: timestamp,
      },
    });

    return userId;
  };
}

/**
 * @param {SaveGeneratedProjectDeps} deps
 */
function createSaveGeneratedProject({ getWXContext, repo, resolveUserId, now }) {
  return async (event, _context) => {
    const requestId = createRequestId(now);

    try {
      const wxContext = getWXContext();
      if (!wxContext.OPENID) {
        throw authenticationError();
      }

      const payload = isRecord(event) ? event : {};
      const userId = await resolveUserId(wxContext.OPENID);
      const project = await repo.saveProject({
        openid: wxContext.OPENID,
        userId,
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
  createUserResolver,
};
