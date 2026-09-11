const { call } = require('../../utils/api');

Page({
  data: { merchants: [], loading: true },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true });
    try { const result = await call('merchantDirectory'); this.setData({ merchants: result.merchants || [] }); }
    catch (error) { wx.showToast({ title: error.message || '加载失败', icon: 'none' }); }
    finally { this.setData({ loading: false }); }
  },
  apply() { wx.navigateTo({ url: '/pages/merchant-apply/merchant-apply' }); },
  openRenovation() { wx.navigateTo({ url: '/pages/renovation-request/renovation-request' }); }
});
