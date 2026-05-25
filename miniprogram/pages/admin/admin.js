const { call } = require('../../utils/api');

Page({
  data: {
    pendingPosts: [],
    reports: [],
    stats: null,
    loading: true
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await call('adminModerate', { action: 'dashboard' });
      this.setData({
        pendingPosts: res.pendingPosts,
        reports: res.reports,
        stats: res.stats
      });
    } catch (error) {
      wx.showToast({ title: error.message || '无权访问', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async moderate(event) {
    const { action, id } = event.currentTarget.dataset;
    await call('adminModerate', { action, targetType: 'post', targetId: id });
    wx.showToast({ title: '已处理', icon: 'success' });
    this.load();
  },

  async handleReport(event) {
    const { id, target } = event.currentTarget.dataset;
    await call('adminModerate', {
      action: 'resolveReport',
      targetType: 'report',
      targetId: id,
      linkedTargetId: target
    });
    wx.showToast({ title: '举报已处理', icon: 'success' });
    this.load();
  }
});
