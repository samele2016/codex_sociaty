App({
  globalData: {
    env: 'replace-with-your-cloud-env-id',
    user: null
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showToast({ title: '基础库不支持云开发', icon: 'none' });
      return;
    }

    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true
    });

    this.login();
  },

  async login() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' });
      this.globalData.user = res.result.user;
      return res.result.user;
    } catch (error) {
      wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
      return null;
    }
  },

  async ensureUser() {
    if (this.globalData.user) {
      return this.globalData.user;
    }
    return this.login();
  }
});
