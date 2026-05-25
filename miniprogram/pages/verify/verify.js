const app = getApp();
const { call } = require('../../utils/api');

Page({
  data: {
    code: '',
    building: '',
    unit: '',
    submitting: false,
    user: null
  },

  async onLoad() {
    this.setData({ user: await app.ensureUser() });
  },

  onInput(event) {
    this.setData({ [event.currentTarget.dataset.key]: event.detail.value });
  },

  async submit() {
    if (!this.data.code.trim()) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const res = await call('verifyInvite', {
        code: this.data.code.trim(),
        building: this.data.building.trim(),
        unit: this.data.unit.trim()
      });
      app.globalData.user = res.user;
      wx.showToast({ title: '认证成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (error) {
      wx.showToast({ title: error.message || '认证失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
