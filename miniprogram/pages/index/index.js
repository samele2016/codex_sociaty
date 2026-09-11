const { call } = require('../../utils/api');

function safeCommunityName(value) {
  const normalized = String(value || '').trim().replace(/悦仕府/g, '阅仕府');
  return !normalized || /[?？�]{2,}/.test(normalized) ? '阅仕府微社区' : normalized;
}

Page({
  data: {
    statusBarHeight: 20,
    communityName: '阅仕府微社区',
    deliveryMonth: '2027年4月',
    apps: [
      { key: 'delivery', label: '工程进度', symbol: '进', tone: 'blue', url: '/pages/delivery/delivery' },
      { key: 'layouts', label: '户型资料', symbol: '户', tone: 'cyan', url: '/pages/delivery/delivery?tab=documents' },
      { key: 'renovation', label: '装修交流', symbol: '装', tone: 'green', category: 'renovation' },
      { key: 'inspection', label: '验房清单', symbol: '验', tone: 'orange', url: '/pages/inspection/inspection' },
      { key: 'budget', label: '装修预算', symbol: '算', tone: 'violet', url: '/pages/budget/budget' },
      { key: 'topics', label: '业主共议', symbol: '议', tone: 'red', url: '/pages/topics/topics' },
      { key: 'service', label: '找装修服务', symbol: '服', tone: 'gold', url: '/pages/renovation-request/renovation-request' },
      { key: 'all', label: '全部应用', symbol: '全', tone: 'gray', tab: '/pages/messages/messages' }
    ],
    latestUpdate: null,
    adBanners: [
      { title: '交付准备资料', desc: '工程进度、户型资料与验房清单', label: '社区服务', tone: 'service', url: '/pages/delivery/delivery' },
      { title: '装修交流专区', desc: '和同户型邻居讨论预算、材料与施工', label: '业主交流', tone: 'community', url: '/pages/channel/channel?category=renovation' },
      { title: '商家合作申请', desc: '提交服务资料，审核通过后参与社区合作', label: '商业合作', tone: 'business', url: '/pages/merchant-apply/merchant-apply' }
    ]
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarHeight: windowInfo.statusBarHeight || 20 });
    this.loadHomeData();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 0 });
  },

  onPullDownRefresh() {
    this.loadHomeData().finally(() => wx.stopPullDownRefresh());
  },

  async loadHomeData() {
    try {
      const [delivery, ads] = await Promise.all([
        call('deliveryHub', { action: 'overview' }),
        call('adManage', { action: 'list' })
      ]);
      const dynamicAds = (ads.ads || []).map((item) => ({
        adId: item._id,
        title: item.title,
        desc: item.content,
        label: `广告 · ${item.merchantName || '合作商家'}`,
        tone: 'business',
        url: '/pages/channel/channel?category=ad'
      }));
      this.setData({
        communityName: safeCommunityName(delivery.communityName),
        latestUpdate: (delivery.updates || [])[0] || null,
        adBanners: dynamicAds.length ? dynamicAds : this.data.adBanners
      });
      if (dynamicAds[0]) this.trackAd(dynamicAds[0].adId, 'impression');
    } catch (error) {
      // 首页保留静态入口，云端恢复后下拉即可刷新。
    }
  },

  onAppTap(event) {
    const item = event.currentTarget.dataset.item || {};
    if (item.tab) return wx.switchTab({ url: item.tab });
    if (item.url) return wx.navigateTo({ url: item.url });
    if (item.category) return wx.navigateTo({ url: `/pages/channel/channel?category=${item.category}` });
  },

  openDelivery() {
    wx.navigateTo({ url: '/pages/delivery/delivery' });
  },

  onAdTap(event) {
    const item = event.currentTarget.dataset.item || {};
    if (item.adId) this.trackAd(item.adId, 'click');
    if (item.url) wx.navigateTo({ url: item.url });
  },

  onAdChange(event) {
    const item = this.data.adBanners[event.detail.current];
    if (item && item.adId) this.trackAd(item.adId, 'impression');
  },

  trackAd(adId, eventType) {
    call('adManage', { action: 'track', adId, eventType }).catch(() => {});
  }
});
