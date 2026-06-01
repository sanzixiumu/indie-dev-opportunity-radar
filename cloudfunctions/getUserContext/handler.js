const DEFAULT_QUOTAS = {
  free: {
    daily_recommend_limit: 3,
    monthly_generate_limit: 1
  },
  pro: {
    daily_recommend_limit: 20,
    monthly_generate_limit: 20
  },
  deep: {
    daily_recommend_limit: 100,
    monthly_generate_limit: 100
  }
};

/**
 * @typedef {"free" | "pro" | "deep"} PlanType
 *
 * @typedef {Record<string, unknown> & {
 *   user_id?: string,
 *   openid?: string,
 *   membership_type?: PlanType,
 *   plan_type?: PlanType,
 *   membership_expired_at?: string | null,
 *   nickname?: string,
 *   avatar_url?: string,
 *   created_at?: string,
 *   updated_at?: string,
 *   last_login_at?: string
 * }} UserRecord
 *
 * @typedef {{ data: UserRecord[] }} QueryResult
 *
 * @typedef {{
 *   get(): Promise<QueryResult>,
 *   update(payload: { data: Partial<UserRecord> }): Promise<{ updated?: number }>
 * }} QueryBuilder
 *
 * @typedef {{
 *   where(query: Partial<UserRecord>): QueryBuilder,
 *   add(payload: { data: UserRecord }): Promise<{ _id?: string }>
 * }} Collection
 *
 * @typedef {{ collection(name: "users"): Collection }} Database
 *
 * @typedef {{ OPENID?: string, APPID?: string, UNIONID?: string }} WXContext
 *
 * @typedef {{
 *   db: Database,
 *   getWXContext(): WXContext,
 *   now(): string,
 *   createId(): string
 * }} GetUserContextDeps
 */

/**
 * @param {() => string} now
 */
function createRequestId(now) {
  return `req_${now().replace(/[-:.TZ]/g, "")}`;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 */
function readNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * @param {unknown} event
 * @returns {Pick<UserRecord, "nickname" | "avatar_url">}
 */
function getProfileFields(event) {
  if (!isRecord(event) || !isRecord(event.userInfo)) {
    return {};
  }

  const userInfo = event.userInfo;
  const nickname = readNonEmptyString(userInfo.nickName) || readNonEmptyString(userInfo.nickname);
  const avatarUrl = readNonEmptyString(userInfo.avatarUrl) || readNonEmptyString(userInfo.avatar_url);
  const profileFields = {};

  if (nickname) {
    profileFields.nickname = nickname;
  }

  if (avatarUrl) {
    profileFields.avatar_url = avatarUrl;
  }

  return profileFields;
}

/**
 * @param {UserRecord} user
 * @returns {PlanType}
 */
function getPlanType(user) {
  return user.membership_type || user.plan_type || "free";
}

/**
 * @param {UserRecord} user
 */
function createQuotaSummary(user) {
  const planType = getPlanType(user);
  const quota = DEFAULT_QUOTAS[planType] || DEFAULT_QUOTAS.free;

  return {
    daily_recommend_used: 0,
    daily_recommend_limit: quota.daily_recommend_limit,
    monthly_generate_used: 0,
    monthly_generate_limit: quota.monthly_generate_limit
  };
}

/**
 * @param {UserRecord} user
 */
function createMembership(user) {
  return {
    plan_type: getPlanType(user),
    expired_at: user.membership_expired_at || null
  };
}

/**
 * @param {GetUserContextDeps} deps
 * @returns {(event: unknown, context: unknown) => Promise<{
 *   ok: boolean,
 *   data?: {
 *     openid: string,
 *     appid: string,
 *     unionid: string,
 *     user: UserRecord,
 *     membership: { plan_type: PlanType, expired_at: string | null },
 *     quota_summary: {
 *       daily_recommend_used: number,
 *       daily_recommend_limit: number,
 *       monthly_generate_used: number,
 *       monthly_generate_limit: number
 *     }
 *   },
 *   error?: { code: string, message: string, action: string },
 *   request_id: string
 * }>}
 */
function createGetUserContext({ db, getWXContext, now, createId }) {
  return async (event, _context) => {
    const requestId = createRequestId(now);
    const wxContext = getWXContext();
    const openid = wxContext.OPENID;
    const profileFields = getProfileFields(event);

    if (!openid) {
      return {
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "未获取到用户身份",
          action: "login"
        },
        request_id: requestId
      };
    }

    const users = db.collection("users");
    const existing = await users.where({ openid }).get();
    let user = existing.data[0];
    const timestamp = now();

    if (!user) {
      user = {
        user_id: createId(),
        openid,
        membership_type: "free",
        membership_expired_at: null,
        created_at: timestamp,
        updated_at: timestamp,
        last_login_at: timestamp,
        ...profileFields
      };
      await users.add({ data: user });
    } else {
      const updateData = {
        updated_at: timestamp,
        last_login_at: timestamp,
        ...profileFields
      };

      await users.where({ openid }).update({
        data: updateData
      });
      user = {
        ...user,
        ...updateData
      };
    }

    return {
      ok: true,
      data: {
        openid,
        appid: wxContext.APPID || "",
        unionid: wxContext.UNIONID || "",
        user,
        membership: createMembership(user),
        quota_summary: createQuotaSummary(user)
      },
      request_id: requestId
    };
  };
}

module.exports = {
  createGetUserContext
};
