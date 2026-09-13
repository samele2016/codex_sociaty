const app = getApp();
const { call, requireVerified } = require('../../utils/api');
const { categories } = require('../../utils/constants');

const descriptions = {
  all: '按时间浏览社区内全部公开信息。',
  idle: '二手、赠送和交换，线下面交请自行确认物品和安全。',
  skill: '家教、维修、摄影、宠物照看等邻里技能互助。',
  partner: '运动、遛娃、读书、桌游等兴趣结伴信息。',
  renovation: '装修预算、设计、施工、材料和避坑交流。',
  ad: '经过审核的本地商家服务和合作信息。',
  groupbuy: '团购接龙、自提信息和社区专场活动。',
  chat: '社区话题、日常分享和邻里交流。',
  help: '失物招领、临时帮忙和求助互助信息。'
};

Page({
  data: {
    category: '',
    categoryLabel: '社区频道',
    description: '',
    posts: [],
    loading: true,
    hasMore: true,
    page: 0
  },

  onLoad(options) {
    const category = options.category || 'renovation';
    const item = categories.find((entry) => entry.key === category);
    this.setData({
      category,
      categoryLabel: item ? item.label : '社区频道',
      description: descriptions[category] || '浏览本频道的邻里信息。'
    });
    this.loadPosts(true);
  },

  onPullDownRefresh() {
    this.loadPosts(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadPosts(false);
  },

  async loadPosts(reset) {
    const page = reset ? 0 : this.data.page;
    this.setData({ loading: true });
    try {
      const res = await call('listPosts', {
        category: this.data.category,
        sort: 'recommended',
        page,
        pageSize: 10
      });
      this.setData({
        posts: reset ? res.posts : this.data.posts.concat(res.posts),
        hasMore: res.hasMore,
        page: page + 1
      });
    } catch (error) {
      wx.showToast({ title: '频道加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async openPublish() {
    const publishCategory = this.data.category === 'all' ? 'renovation' : this.data.category;
    const returnUrl = `/pages/channel/channel?category=${this.data.category}`;
    const user = await app.login();
    if (!requireVerified(user, { returnUrl })) return;
    wx.navigateTo({ url: `/pages/publish/publish?category=${publishCategory}&returnUrl=${encodeURIComponent(returnUrl)}` });
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  }
});
