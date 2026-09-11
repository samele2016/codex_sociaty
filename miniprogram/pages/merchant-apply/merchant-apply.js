const app = getApp();
const { call } = require('../../utils/api');

const choices = [
  { key: 'design', label: '\u8bbe\u8ba1' },
  { key: 'construction', label: '\u65bd\u5de5' },
  { key: 'material', label: '\u4e3b\u6750/\u8f85\u6750' },
  { key: 'furniture', label: '\u5bb6\u5177\u8f6f\u88c5' },
  { key: 'cleaning', label: '\u4fdd\u6d01\u5bb6\u653f' }
];

Page({
  data: {
    user: null,
    choices,
    selected: [],
    businessName: '',
    contact: '',
    description: '',
    serviceScope: '',
    priceNotes: '',
    qualificationFiles: [],
    caseImages: [],
    submitting: false,
    applications: []
  },
  async onLoad() {
    this.setData({ user: await app.ensureUser() });
    this.loadMine();
  },
  onInput(event) {
    this.setData({ [event.currentTarget.dataset.key]: event.detail.value });
  },
  onCategoryChange(event) {
    this.setData({ selected: event.detail.value || [] });
  },
  async chooseQualificationFiles() {
    try {
      const result = await new Promise((resolve, reject) => wx.chooseMessageFile({ count: 6, type: 'all', success: resolve, fail: reject }));
      const files = await Promise.all((result.tempFiles || []).map((file) => {
        const name = String(file.name || 'file').replace(/[^\w.-]/g, '_');
        return wx.cloud.uploadFile({ cloudPath: `merchant-qualification/${Date.now()}-${Math.random().toString(16).slice(2)}-${name}`, filePath: file.path });
      }));
      this.setData({ qualificationFiles: files.map((file) => file.fileID) });
      wx.showToast({ title: `\u5df2\u4e0a\u4f20 ${files.length} \u4efd`, icon: 'success' });
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) return;
      wx.showToast({ title: '\u8d44\u8d28\u4e0a\u4f20\u5931\u8d25', icon: 'none' });
    }
  },
  async chooseCaseImages() {
    const remaining = 6 - this.data.caseImages.length;
    if (remaining <= 0) return;
    try {
      const result = await new Promise((resolve, reject) => wx.chooseImage({ count: remaining, sizeType: ['compressed'], success: resolve, fail: reject }));
      const uploads = await Promise.all((result.tempFilePaths || []).map((filePath) => wx.cloud.uploadFile({
        cloudPath: `merchant-cases/${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`,
        filePath
      })));
      this.setData({ caseImages: this.data.caseImages.concat(uploads.map((item) => item.fileID)) });
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) return;
      wx.showToast({ title: '\u6848\u4f8b\u56fe\u4e0a\u4f20\u5931\u8d25', icon: 'none' });
    }
  },
  removeCaseImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ caseImages: this.data.caseImages.filter((_, itemIndex) => itemIndex !== index) });
  },
  async loadMine() {
    try {
      const result = await call('merchantApply', { action: 'mine' });
      this.setData({ applications: result.applications || [] });
    } catch (error) {
      this.setData({ applications: [] });
    }
  },
  async submit() {
    if (!this.data.user) {
      wx.showToast({ title: '登录状态获取失败，请重试', icon: 'none' });
      return;
    }
    if (this.data.user.role === 'merchant') {
      wx.showToast({ title: '当前账号已经是入驻商家', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await call('merchantApply', {
        action: 'submit',
        businessName: this.data.businessName,
        contact: this.data.contact,
        description: this.data.description,
        serviceScope: this.data.serviceScope,
        priceNotes: this.data.priceNotes,
        categories: this.data.selected,
        qualificationFiles: this.data.qualificationFiles,
        caseImages: this.data.caseImages
      });
      wx.showToast({ title: '\u7533\u8bf7\u5df2\u63d0\u4ea4', icon: 'success' });
      this.loadMine();
    } catch (error) {
      wx.showToast({ title: error.message || '\u63d0\u4ea4\u5931\u8d25', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
