const { call } = require('../../utils/api');

const requestTypes = [
  { key: 'correction', label: '\u66f4\u6b63\u6211\u7684\u8ba4\u8bc1\u6216\u8d44\u6599\u4fe1\u606f' },
  { key: 'deletion', label: '\u7533\u8bf7\u6ce8\u9500\u8d26\u53f7\u4e0e\u5220\u9664\u4fe1\u606f' },
  { key: 'complaint', label: '\u9690\u79c1\u6216\u670d\u52a1\u6295\u8bc9' }
];
const statusText = {
  pending: '\u5904\u7406\u4e2d',
  resolved: '\u5df2\u5904\u7406',
  rejected: '\u5df2\u56de\u590d'
};

Page({
  data: { requestTypes, typeIndex: 0, content: '', requests: [], submitting: false },
  onLoad() { this.loadRequests(); },
  async loadRequests() {
    try {
      const result = await call('accountService', { action: 'mine' });
      this.setData({
        requests: (result.requests || []).map((item) => Object.assign({}, item, {
          typeText: (requestTypes.find((type) => type.key === item.type) || {}).label || item.type,
          statusText: statusText[item.status] || item.status
        }))
      });
    } catch (error) {
      this.setData({ requests: [] });
    }
  },
  onTypeChange(event) { this.setData({ typeIndex: Number(event.detail.value) }); },
  onContentInput(event) { this.setData({ content: event.detail.value }); },
  async submit() {
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({ title: '\u8bf7\u586b\u5199\u7533\u8bf7\u8bf4\u660e', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await call('accountService', { action: 'submit', type: requestTypes[this.data.typeIndex].key, content });
      wx.showToast({ title: '\u7533\u8bf7\u5df2\u63d0\u4ea4', icon: 'success' });
      this.setData({ content: '' });
      this.loadRequests();
    } catch (error) {
      wx.showToast({ title: error.message || '\u63d0\u4ea4\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
