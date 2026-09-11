const app = getApp();
const { call, requireVerified } = require('../../utils/api');

Page({
  data: {
    user: null,
    houseType: '',
    budget: '',
    startDate: '',
    demand: '',
    contact: '',
    contactAuthorized: false,
    submitting: false,
    requests: []
  },

  async onLoad() {
    this.setData({ user: await app.ensureUser() });
    this.loadMine();
  },

  onInput(event) {
    this.setData({ [event.currentTarget.dataset.key]: event.detail.value });
  },

  onConsentChange(event) {
    this.setData({ contactAuthorized: Boolean(event.detail.value.length) });
  },

  async loadMine() {
    try {
      const result = await call('renovationLead', { action: 'mine' });
      this.setData({ requests: result.requests || [] });
    } catch (error) {
      // Unverified users can still view the form and receive the verification guidance.
    }
  },

  async submit() {
    if (!requireVerified(this.data.user)) return;
    if (!this.data.demand.trim() || (this.data.contactAuthorized && !this.data.contact.trim())) {
      wx.showToast({ title: '请填写需求并确认联系方式', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await call('renovationLead', {
        action: 'create',
        houseType: this.data.houseType,
        budget: this.data.budget,
        startDate: this.data.startDate,
        demand: this.data.demand,
        contact: this.data.contact,
        contactAuthorized: this.data.contactAuthorized
      });
      wx.showToast({ title: '需求已提交', icon: 'success' });
      this.setData({ demand: '', contact: '', contactAuthorized: false });
      this.loadMine();
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  revokeContact(event) {
    const { id } = event.currentTarget.dataset;
    wx.showModal({
      title: '撤回联系方式授权',
      content: '撤回后，已分配的商家将不再看到你的联系方式。该操作不可撤销。',
      confirmText: '确认撤回',
      confirmColor: '#b42318',
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await call('renovationLead', { action: 'revokeContact', id });
          wx.showToast({ title: '已撤回授权', icon: 'success' });
          this.loadMine();
        } catch (error) {
          wx.showToast({ title: error.message || '操作失败', icon: 'none' });
        }
      }
    });
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/verify/verify' });
  }
});
