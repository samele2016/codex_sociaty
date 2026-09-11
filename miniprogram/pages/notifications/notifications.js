const { call } = require('../../utils/api');

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

Page({
  data: { notifications: [], unreadCount: 0, loading: true },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const result = await call('notificationService', { action: 'mine' });
      this.setData({
        notifications: (result.notifications || []).map((item) => Object.assign({}, item, { createdAtText: formatTime(item.createdAt) })),
        unreadCount: result.unreadCount || 0
      });
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
      this.setData({ notifications: [], unreadCount: 0 });
    } finally {
      this.setData({ loading: false });
    }
  },

  async markAllRead() {
    if (!this.data.unreadCount) return;
    try {
      await call('notificationService', { action: 'markAllRead' });
      this.setData({ notifications: this.data.notifications.map((item) => Object.assign({}, item, { read: true })), unreadCount: 0 });
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    }
  },

  async openNotification(event) {
    const item = event.currentTarget.dataset.item;
    if (!item) return;
    if (!item.read) {
      try { await call('notificationService', { action: 'markRead', id: item._id }); } catch (error) { /* Keep navigation available when read-state update fails. */ }
      this.setData({ notifications: this.data.notifications.map((notification) => notification._id === item._id ? Object.assign({}, notification, { read: true }) : notification), unreadCount: Math.max(0, this.data.unreadCount - 1) });
    }
    if (!item.route) return;
    const tabPages = ['/pages/index/index', '/pages/messages/messages', '/pages/profile/profile'];
    if (tabPages.includes(item.route.split('?')[0])) {
      wx.switchTab({ url: item.route.split('?')[0] });
      return;
    }
    wx.navigateTo({ url: item.route });
  }
});
