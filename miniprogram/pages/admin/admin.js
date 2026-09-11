const { call } = require('../../utils/api');
const { categories } = require('../../utils/constants');

const boardCategories = categories.filter((item) => item.key !== 'all');

Page({
  data: {
    pendingPosts: [],
    reports: [],
    pendingUsers: [],
    merchants: [],
    reviewers: [],
    boardCategories,
    selectedMerchant: null,
    selectedCategories: [],
    isSystemAdmin: false,
    canReviewOwners: false,
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
        pendingUsers: res.pendingUsers || [],
        merchants: res.merchants || [],
        reviewers: res.reviewers || [],
        isSystemAdmin: ['admin', 'system_admin'].includes((getApp().globalData.user || {}).role),
        canReviewOwners: Boolean(res.canReviewOwners),
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
    try {
      await call('adminModerate', { action, targetType: 'post', targetId: id });
    } catch (error) {
      wx.showToast({ title: error.message || '处理失败', icon: 'none' });
      return;
    }
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
,

  async approveUser(event) {
    const { action, id } = event.currentTarget.dataset;
    try {
      await call('adminModerate', { action, targetType: 'user', targetId: id });
      wx.showToast({ title: action === 'approveUser' ? '认证已通过' : '已驳回申请', icon: 'success' });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '处理失败', icon: 'none' });
    }
  },

  selectMerchant(event) {
    const id = event.currentTarget.dataset.id;
    const merchant = this.data.merchants.find((item) => item._id === id);
    this.setData({ selectedMerchant: merchant, selectedCategories: (merchant && merchant.merchantCategories) || [] });
  },

  onMerchantCategoryChange(event) {
    this.setData({ selectedCategories: event.detail.value || [] });
  },

  async saveMerchantCategories() {
    if (!this.data.selectedMerchant) return;
    try {
      await call('adminModerate', {
        action: 'assignMerchantCategories',
        targetType: 'user',
        targetId: this.data.selectedMerchant._id,
        categories: this.data.selectedCategories
      });
      wx.showToast({ title: '板块权限已保存', icon: 'success' });
      this.setData({ selectedMerchant: null, selectedCategories: [] });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    }
  }
,

  async toggleOwnerReviewer(event) {
    const targetId = event.currentTarget.dataset.id;
    const enabled = event.currentTarget.dataset.enabled !== true && event.currentTarget.dataset.enabled !== 'true';
    try {
      await call('adminModerate', { action: 'setOwnerReviewer', targetId, enabled });
      wx.showToast({ title: enabled ? '已授予认证审核权限' : '已收回认证审核权限', icon: 'success' });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    }
  }
});
