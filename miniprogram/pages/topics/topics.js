const app = getApp();
const { call, requireVerified } = require('../../utils/api');

const categories = [{ key: 'delivery', label: '交付与工程' }, { key: 'renovation', label: '装修准备' }, { key: 'community', label: '社区服务' }];

Page({
  data: { topics: [], loading: true, composing: false, title: '', content: '', categoryIndex: 0, categories, submitting: false },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true });
    try { const result = await call('communityTopics', { action: 'list' }); this.setData({ topics: result.topics || [] }); }
    catch (error) { wx.showToast({ title: error.message || '加载失败', icon: 'none' }); }
    finally { this.setData({ loading: false }); }
  },
  async openComposer() {
    const user = await app.login();
    if (!requireVerified(user, { returnUrl: '/pages/topics/topics' })) return;
    this.setData({ composing: true });
  },
  closeComposer() { this.setData({ composing: false }); },
  onInput(event) { this.setData({ [event.currentTarget.dataset.key]: event.detail.value }); },
  onCategoryChange(event) { this.setData({ categoryIndex: Number(event.detail.value) }); },
  async submit() {
    if (!this.data.title.trim() || !this.data.content.trim()) { wx.showToast({ title: '请填写问题标题和说明', icon: 'none' }); return; }
    this.setData({ submitting: true });
    try {
      await call('communityTopics', { action: 'create', title: this.data.title, content: this.data.content, category: categories[this.data.categoryIndex].key });
      wx.showToast({ title: '问题已发布', icon: 'success' });
      this.setData({ composing: false, title: '', content: '' });
      this.load();
    } catch (error) { wx.showToast({ title: error.message || '发布失败', icon: 'none' }); }
    finally { this.setData({ submitting: false }); }
  },
  async vote(event) {
    const user = await app.login();
    if (!requireVerified(user, { returnUrl: '/pages/topics/topics' })) return;
    try { await call('communityTopics', { action: 'toggleVote', id: event.currentTarget.dataset.id }); this.load(); }
    catch (error) { wx.showToast({ title: error.message || '投票失败', icon: 'none' }); }
  }
});
