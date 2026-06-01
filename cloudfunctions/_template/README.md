# 云函数模板

这个目录用于保存云函数依赖模板，不作为正式云函数部署。

创建新函数时，复制本目录的文件到目标函数目录，并把目标目录中的 `package.json` 按函数名调整：

```bash
cd /Users/mac/indie-dev-opportunity-radar
mkdir -p cloudfunctions/getUserContext
cp cloudfunctions/_template/package.json cloudfunctions/_template/pnpm-lock.yaml cloudfunctions/_template/index.js cloudfunctions/_template/tsconfig.json cloudfunctions/getUserContext/
cp -R cloudfunctions/_template/types cloudfunctions/getUserContext/types
cd cloudfunctions/getUserContext
pnpm install
```

正式函数应使用 Event Function 入口：

```js
const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  return {
    ok: true,
    openid: wxContext.OPENID
  };
};
```
