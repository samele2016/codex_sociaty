const app = getApp();
const { call } = require('../../utils/api');

Page({
  data: {
    code: '',
    nickName: '',
    houseNumber: '',
    submitting: false,
    user: null,
    privacyAccepted: false,
    statusBarHeight: 20,
    navHeight: 44,
    returnUrl: ''
  },

  async onLoad(options) {
    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    let returnUrl = '';
    if (options && options.returnUrl) {
      try { returnUrl = decodeURIComponent(options.returnUrl); } catch (error) { returnUrl = options.returnUrl; }
    }
    this.setData({ user: await app.ensureUser(), statusBarHeight: systemInfo.statusBarHeight || 20, returnUrl });
  },

  handleBack() {
    if (this.data.returnUrl) {
      this.leaveToReturn();
      return;
    }
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/profile/profile' }) });
      return;
    }
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  leaveToReturn() {
    const url = this.data.returnUrl;
    const tabPages = ['/pages/index/index', '/pages/messages/messages', '/pages/profile/profile'];
    if (tabPages.includes(url.split('?')[0])) {
      wx.switchTab({ url: url.split('?')[0] });
      return;
    }
    wx.redirectTo({ url, fail: () => wx.switchTab({ url: '/pages/profile/profile' }) });
  },

  onInput(event) {
    const key = event.currentTarget.dataset.key;
    const value = key === 'houseNumber'
      ? event.detail.value.replace(/－/g, '-').replace(/\s+/g, '')
      : event.detail.value;
    this.setData({ [key]: value });
  },

  onPrivacyChange(event) {
    this.setData({ privacyAccepted: Boolean(event.detail.value.length) });
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  async submit() {
    const code = this.data.code.trim();
    const nickName = this.data.nickName.trim();
    const houseNumber = this.data.houseNumber.trim();
    if (!code || !nickName || !houseNumber) {
      wx.showToast({ title: '请完整填写昵称、房号和邀请码', icon: 'none' });
      return;
    }
    if (!/^(阅|朝)-\d{1,2}-\d{3,4}$/.test(houseNumber)) {
      wx.showToast({ title: '请输入完整房号，如 阅-1-101', icon: 'none' });
      return;
    }
    if (!this.data.privacyAccepted) {
      wx.showToast({ title: '请先阅读并同意隐私说明', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const res = await call('verifyInvite', {
        code,
        nickName,
        houseNumber,
        privacyAccepted: true
      });
      app.globalData.user = res.user;
      wx.showToast({ title: '申请已提交', icon: 'success' });
      setTimeout(() => {
        if (this.data.returnUrl) this.leaveToReturn();
        else wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/profile/profile' }) });
      }, 600);
    } catch (error) {
      const message = error.message || error.errMsg || '认证失败，请稍后重试';
      wx.showModal({ title: '认证未提交', content: message, showCancel: false });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
