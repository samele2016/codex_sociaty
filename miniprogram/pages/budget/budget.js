const levels = [
  { label: '基础实用', low: 1000, high: 1400, note: '以基础施工、常规主材和实用收纳为主' },
  { label: '舒适品质', low: 1600, high: 2200, note: '兼顾设计、主材品质与局部定制' },
  { label: '高配定制', low: 2400, high: 3400, note: '更高比例的定制、设备与工艺预算' }
];

function formatMoney(value) { return Math.round(value / 1000) * 1000; }

Page({
  data: { area: '', levelIndex: 1, levels, result: null },

  onAreaInput(event) { this.setData({ area: event.detail.value }); },
  onLevelChange(event) { this.setData({ levelIndex: Number(event.detail.value), result: null }); },
  calculate() {
    const area = Number(this.data.area);
    if (!Number.isFinite(area) || area < 30 || area > 300) {
      wx.showToast({ title: '请输入 30-300 平方米的套内面积', icon: 'none' });
      return;
    }
    const level = levels[this.data.levelIndex];
    const baseLow = area * level.low;
    const baseHigh = area * level.high;
    const reserveLow = baseLow * .08;
    const reserveHigh = baseHigh * .08;
    this.setData({ result: {
      low: formatMoney(baseLow + reserveLow), high: formatMoney(baseHigh + reserveHigh),
      reserveLow: formatMoney(reserveLow), reserveHigh: formatMoney(reserveHigh), level
    } });
  },
  openRequest() { wx.navigateTo({ url: '/pages/renovation-request/renovation-request' }); }
});
