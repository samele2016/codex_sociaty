const STORAGE_KEY = 'yueshifu-inspection-checklist';

const groups = [
  { title: '入户与客厅', items: ['入户门开合、锁具与门框', '墙面、顶面是否空鼓、开裂或渗痕', '地面平整度与踢脚线收口', '开关、插座、弱电箱通电与标识'] },
  { title: '厨房与卫生间', items: ['给排水接口、地漏与闭水情况', '烟道、止回阀和燃气预留位置', '防水高度、阴阳角与瓷砖空鼓', '排风、照明、插座及等电位端子'] },
  { title: '卧室与阳台', items: ['窗扇、纱窗、玻璃与密封胶', '栏杆、栏板与阳台排水坡度', '空调孔、冷凝水管和地漏预留', '房间门、门套、墙地面收口'] },
  { title: '公共与资料', items: ['水电燃气表底数及表箱编号', '交付资料、质保书和维修联系人', '楼道、电梯、消防设施与公共区域', '问题拍照、位置记录和整改时限'] }
];

Page({
  data: { groups: [], checkedCount: 0, total: 0, percent: 0 },

  onLoad() {
    const saved = wx.getStorageSync(STORAGE_KEY) || {};
    const withState = groups.map((group, groupIndex) => ({
      title: group.title,
      items: group.items.map((label, itemIndex) => ({ label, key: `${groupIndex}-${itemIndex}`, checked: Boolean(saved[`${groupIndex}-${itemIndex}`]) }))
    }));
    this.setData({ groups: withState });
    this.refreshProgress();
  },

  toggleItem(event) {
    const { group, item } = event.currentTarget.dataset;
    const path = `groups[${group}].items[${item}].checked`;
    this.setData({ [path]: !this.data.groups[group].items[item].checked }, () => this.save());
  },

  save() {
    const saved = {};
    this.data.groups.forEach((group) => group.items.forEach((item) => { saved[item.key] = item.checked; }));
    wx.setStorageSync(STORAGE_KEY, saved);
    this.refreshProgress();
  },

  refreshProgress() {
    const all = this.data.groups.reduce((list, group) => list.concat(group.items), []);
    const checkedCount = all.filter((item) => item.checked).length;
    this.setData({ checkedCount, total: all.length, percent: all.length ? Math.round(checkedCount * 100 / all.length) : 0 });
  },

  reset() {
    wx.showModal({ title: '清空清单', content: '将清空本机保存的验房进度。', success: (res) => {
      if (!res.confirm) return;
      wx.removeStorageSync(STORAGE_KEY);
      this.onLoad();
    } });
  }
});
