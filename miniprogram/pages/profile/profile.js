const app = getApp();
const { call } = require('../../utils/api');

Page({
  data: {
    user: null,
    stats: null
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 2 });
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
  },

  goM1Admin() {
    wx.navigateTo({ url: '/pages/admin-m1/admin-m1' });
  },

  goMerchantApply() {
    wx.navigateTo({ url: '/pages/merchant-apply/merchant-apply' });
  },

  goMerchantLeads() {
    wx.navigateTo({ url: '/pages/merchant-leads/merchant-leads' });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  }
});
