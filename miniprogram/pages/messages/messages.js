const app = getApp();
const { requireVerified } = require('../../utils/api');

Page({
  data: {
    sections: [
      {
        title: '交付与装修',
        items: [
          { label: '工程进度', desc: '查看交付节点与现场动态', symbol: '进', tone: 'blue', url: '/pages/delivery/delivery' },
          { label: '户型资料', desc: '集中查找户型图与交付文件', symbol: '型', tone: 'green', url: '/pages/delivery/delivery?tab=documents' },
          { label: '验房清单', desc: '按空间逐项核验并留存结果', symbol: '验', tone: 'orange', url: '/pages/inspection/inspection' },
          { label: '装修预算', desc: '记录预算、报价与实际支出', symbol: '算', tone: 'red', url: '/pages/budget/budget' },
          { label: '装修交流', desc: '看方案、材料与施工经验', symbol: '装', tone: 'purple', category: 'renovation' },
          { label: '业主共议', desc: '围绕交付和公共事项讨论', symbol: '议', tone: 'cyan', url: '/pages/topics/topics' },
          { label: '找装修服务', desc: '查看已入驻商家与服务', symbol: '商', tone: 'gold', url: '/pages/merchants/merchants' },
          { label: '发布装修需求', desc: '提交需求并等待商家响应', symbol: '需', tone: 'pink', url: '/pages/renovation-request/renovation-request' }
        ]
      },
      {
        title: '邻里交流',
        items: [
          { label: '闲置物品', desc: '转让或求购邻里闲置', symbol: '闲', tone: 'green', category: 'idle' },
          { label: '技能交换', desc: '互助交换经验和技能', symbol: '技', tone: 'blue', category: 'skill' },
          { label: '兴趣搭子', desc: '寻找运动、遛娃与兴趣伙伴', symbol: '伴', tone: 'purple', category: 'partner' },
          { label: '商家广告', desc: '查看明确标注的商业推广', symbol: '广', tone: 'red', category: 'ad' },
          { label: '社区团购', desc: '团购信息与报名接龙', symbol: '团', tone: 'orange', category: 'groupbuy' },
          { label: '闲聊论坛', desc: '分享社区日常与见闻', symbol: '聊', tone: 'cyan', category: 'chat' },
          { label: '求助互助', desc: '发布紧急或日常求助', symbol: '助', tone: 'pink', category: 'help' },
          { label: '全部帖子', desc: '浏览社区全部公开内容', symbol: '全', tone: 'gold', url: '/pages/channel/channel?category=all&title=全部帖子' }
        ]
      },
      {
        title: '账号与合作',
        items: [
          { label: '消息通知', desc: '查看审核与互动提醒', symbol: '信', tone: 'blue', url: '/pages/notifications/notifications' },
          { label: '商家入驻', desc: '外部商家可独立提交入驻申请', symbol: '入', tone: 'green', url: '/pages/merchant-apply/merchant-apply' }
        ]
      }
    ]
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  async openPublish() {
    const user = await app.login();
    if (!user) return;
    if (!requireVerified(user, { returnUrl: '/pages/messages/messages' })) return;
    wx.navigateTo({ url: '/pages/publish/publish?returnUrl=%2Fpages%2Fmessages%2Fmessages' });
  },

  onAppTap(event) {
    const { item } = event.currentTarget.dataset;
    if (item.url) {
      wx.navigateTo({ url: item.url });
      return;
    }
    if (item.category) {
      wx.navigateTo({
        url: `/pages/channel/channel?category=${item.category}&title=${encodeURIComponent(item.label)}`
      });
    }
  }
});
