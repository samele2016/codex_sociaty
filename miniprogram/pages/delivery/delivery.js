const { call } = require('../../utils/api');

function safeCommunityName(value) {
  const normalized = String(value || '').trim().replace(/悦仕府/g, '阅仕府');
  return !normalized || /[?？�]{2,}/.test(normalized) ? '阅仕府微社区' : normalized;
}

Page({
  data: { activeTab: 'updates', deliveryDate: '2027-04-01', communityName: '阅仕府微社区', updates: [], documents: [], loading: true },

  onLoad(options) {
    this.setData({ activeTab: options && options.tab === 'documents' ? 'documents' : 'updates' });
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const result = await call('deliveryHub', { action: 'overview' });
      this.setData(Object.assign({}, result, { communityName: safeCommunityName(result.communityName) }));
    } catch (error) {
      wx.showToast({ title: error.message || '资料加载失败', icon: 'none' });
    } finally { this.setData({ loading: false }); }
  },

  switchTab(event) { this.setData({ activeTab: event.currentTarget.dataset.tab }); },
  goBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }); },
  openRenovation() { wx.navigateTo({ url: '/pages/renovation-request/renovation-request' }); },
  openInspection() { wx.navigateTo({ url: '/pages/inspection/inspection' }); },
  openBudget() { wx.navigateTo({ url: '/pages/budget/budget' }); },
  async preview(event) {
    const file = event.currentTarget.dataset.file;
    if (!file) return;
    try {
      const result = await wx.cloud.downloadFile({ fileID: file });
      wx.openDocument({ filePath: result.tempFilePath, showMenu: true, fail: () => wx.previewImage({ urls: [result.tempFilePath] }) });
    } catch (error) { wx.showToast({ title: '资料打开失败', icon: 'none' }); }
  }
});
