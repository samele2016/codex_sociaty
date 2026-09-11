const { call } = require('../../utils/api');

const statusText = {
  assigned: '\u5f85\u8ddf\u8fdb',
  accepted: '\u5df2\u63a5\u6536',
  contacted: '\u5df2\u8054\u7cfb',
  closed: '\u5df2\u5b8c\u6210',
  declined: '\u5df2\u9000\u56de'
};

Page({
  data: { leads: [], loading: true, updatingId: '' },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true });
    try {
      const result = await call('renovationLead', { action: 'merchantMine' });
      this.setData({ leads: (result.leads || []).map((item) => Object.assign({}, item, { statusText: statusText[item.status] || item.status })) });
    } catch (error) {
      wx.showToast({ title: error.message || '\u52a0\u8f7d\u5931\u8d25', icon: 'none' });
      this.setData({ leads: [] });
    } finally {
      this.setData({ loading: false });
    }
  },
  async updateStatus(event) {
    const { id, status } = event.currentTarget.dataset;
    this.setData({ updatingId: id });
    try {
      await call('renovationLead', { action: 'merchantUpdateStatus', id, status });
      wx.showToast({ title: '\u7ebf\u7d22\u72b6\u6001\u5df2\u66f4\u65b0', icon: 'success' });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '\u66f4\u65b0\u5931\u8d25', icon: 'none' });
    } finally {
      this.setData({ updatingId: '' });
    }
  }
});
