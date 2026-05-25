const { categories } = require('../../utils/constants');
const { call } = require('../../utils/api');

Page({
  data: {
    categories,
    activeCategory: 'all',
    sort: 'latest',
    posts: [],
    loading: false,
    hasMore: true,
    page: 0,
    keyword: ''
  },

  onLoad() {
    this.loadPosts(true);
  },

  onPullDownRefresh() {
    this.loadPosts(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts(false);
    }
  },

  async loadPosts(reset) {
    const page = reset ? 0 : this.data.page;
    this.setData({ loading: true });
    try {
      const res = await call('listPosts', {
        category: this.data.activeCategory,
        sort: this.data.sort,
        keyword: this.data.keyword,
        page,
        pageSize: 12
      });
      this.setData({
        posts: reset ? res.posts : this.data.posts.concat(res.posts),
        hasMore: res.hasMore,
        page: page + 1
      });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onCategoryTap(event) {
    this.setData({ activeCategory: event.currentTarget.dataset.key });
    this.loadPosts(true);
  },

  onSortTap(event) {
    this.setData({ sort: event.currentTarget.dataset.sort });
    this.loadPosts(true);
  },

  onSearchInput(event) {
    this.setData({ keyword: event.detail.value });
  },

  onSearchConfirm() {
    this.loadPosts(true);
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  }
});
