App({
  globalData: {
    envId: "cloud1-d8gh1a3icf3f03932"
  },

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: "cloud1-d8gh1a3icf3f03932",
        traceUser: true
      });
    } else {
      console.warn("当前基础库不支持 wx.cloud，请在微信开发者工具中开启云开发能力。");
    }
  }
});
