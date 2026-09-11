Component({
  data: {
    selected: 0,
    items: [
      { pagePath: '/pages/index/index', label: '首页', icon: 'home' },
      { pagePath: '/pages/messages/messages', label: '全部应用', icon: 'grid' },
      { pagePath: '/pages/profile/profile', label: '个人中心', icon: 'user' }
    ]
  },

  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const item = this.data.items[index];
      if (!item) return;
      wx.switchTab({ url: item.pagePath });
    }
  }
});
