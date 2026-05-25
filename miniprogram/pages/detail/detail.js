const app = getApp();
const { call, requireVerified } = require('../../utils/api');

Page({
  data: {
    id: '',
    post: null,
    comments: [],
    comment: '',
    loading: true,
    contactVisible: false,
    user: null
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.loadDetail(false);
  },

  async loadDetail(withContact) {
    this.setData({ loading: true });
    try {
      const user = await app.ensureUser();
      const res = await call('getPostDetail', { id: this.data.id, withContact });
      this.setData({
        user,
        post: res.post,
        comments: res.comments,
        contactVisible: Boolean(res.post.contact)
      });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async showContact() {
    const user = await app.ensureUser();
    if (!requireVerified(user)) {
      return;
    }
    this.loadDetail(true);
  },

  onCommentInput(event) {
    this.setData({ comment: event.detail.value });
  },

  async submitComment() {
    const user = await app.ensureUser();
    if (!requireVerified(user)) {
      return;
    }
    if (!this.data.comment.trim()) {
      return;
    }
    try {
      await call('createComment', { postId: this.data.id, content: this.data.comment.trim() });
      this.setData({ comment: '' });
      this.loadDetail(false);
    } catch (error) {
      wx.showToast({ title: error.message || '评论失败', icon: 'none' });
    }
  },

  async toggleLike() {
    await call('toggleLikeFavorite', { postId: this.data.id, type: 'like' });
    this.loadDetail(false);
  },

  async toggleFavorite() {
    await call('toggleLikeFavorite', { postId: this.data.id, type: 'favorite' });
    this.loadDetail(false);
  },

  report() {
    wx.showActionSheet({
      itemList: ['广告骚扰', '交易风险', '不实信息', '不友善内容'],
      success: async (res) => {
        const reasons = ['广告骚扰', '交易风险', '不实信息', '不友善内容'];
        await call('reportContent', {
          targetType: 'post',
          targetId: this.data.id,
          reason: reasons[res.tapIndex]
        });
        wx.showToast({ title: '已提交举报', icon: 'success' });
      }
    });
  }
});
