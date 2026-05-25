const app = getApp();
const { call } = require('../../utils/api');

Page({
  data: {
    user: null,
    stats: null
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    const user = await app.login();
    this.setData({ user });
    try {
      const stats = await call('listPosts', { mine: true, page: 0, pageSize: 1 });
      this.setData({ stats: stats.summary || null });
    } catch (error) {
      this.setData({ stats: null });
    }
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/verify/verify' });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  }
});
