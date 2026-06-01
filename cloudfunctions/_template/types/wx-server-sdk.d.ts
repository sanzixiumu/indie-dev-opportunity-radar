declare module "wx-server-sdk" {
  export const DYNAMIC_CURRENT_ENV: string;

  export function init(options?: { env?: string }): void;

  export function getWXContext(): {
    OPENID: string;
    APPID?: string;
    UNIONID?: string;
  };
}
