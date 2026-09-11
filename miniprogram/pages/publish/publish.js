const app = getApp();
const { categories } = require('../../utils/constants');
const { call, requireVerified } = require('../../utils/api');

const publishCategories = categories.filter((item) => item.key !== 'all');

Page({
  data: {
    categories: publishCategories,
    categoryIndex: 0,
    title: '',
    content: '',
    contact: '',
    images: [],
    fields: {},
    fieldPairs: [],
    returnUrl: '',
    submitting: false
  },

  onLoad(options) {
    const categoryIndex = publishCategories.findIndex((item) => item.key === options.category);
    let returnUrl = '';
    if (options.returnUrl) {
      try { returnUrl = decodeURIComponent(options.returnUrl); } catch (error) { returnUrl = options.returnUrl; }
    }
    this.setData({ categoryIndex: categoryIndex >= 0 ? categoryIndex : 0, returnUrl });
  },

  async onShow() {
    const user = await app.login();
    if (!requireVerified(user, { returnUrl: this.data.returnUrl })) {
      if (user && user.verificationStatus === 'pending') {
        setTimeout(() => this.leaveAfterPublish(), 500);
      }
      return;
    }
  },

  onCategoryChange(event) {
    this.setData({ categoryIndex: Number(event.detail.value), fields: {}, fieldPairs: [] });
  },

  onInput(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ [key]: event.detail.value });
  },

  onFieldInput(event) {
    const key = event.currentTarget.dataset.key;
    const fields = Object.assign({}, this.data.fields, { [key]: event.detail.value });
    this.setData({ fields, fieldPairs: this.buildFieldPairs(fields) });
  },

  buildFieldPairs(fields) {
    return Object.keys(fields).map((key) => ({ key, value: fields[key] }));
  },

  async chooseImages() {
    const res = await wx.chooseMedia({
      count: 6 - this.data.images.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera']
    });
    this.setData({
      images: this.data.images.concat(res.tempFiles.map((file) => file.tempFilePath)).slice(0, 6)
    });
  },

  removeImage(event) {
    const index = event.currentTarget.dataset.index;
    const images = this.data.images.slice();
    images.splice(index, 1);
    this.setData({ images });
  },

  async submit() {
    const user = await app.login();
    if (!requireVerified(user, { returnUrl: this.data.returnUrl })) {
      return;
    }
    if (!this.data.title.trim() || !this.data.content.trim()) {
      wx.showToast({ title: '标题和正文必填', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const uploaded = await this.uploadImages();
      const category = this.data.categories[this.data.categoryIndex].key;
      const res = await call('createPost', {
        category,
        title: this.data.title.trim(),
        content: this.data.content.trim(),
        contact: this.data.contact.trim(),
        images: uploaded,
        fields: this.data.fields
      });
      wx.showModal({
        title: res.status === 'pending' ? '已提交审核' : '发布成功',
        content: res.message,
        showCancel: false,
        success: () => this.leaveAfterPublish()
      });
    } catch (error) {
      wx.showToast({ title: error.message || '发布失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  leaveAfterPublish() {
    if (this.data.returnUrl) {
      const targetPath = this.data.returnUrl.split('?')[0].replace(/^\//, '');
      const pages = getCurrentPages();
      const previous = pages[pages.length - 2];
      if (previous && previous.route === targetPath) {
        wx.navigateBack({ delta: 1 });
        return;
      }
      wx.redirectTo({ url: this.data.returnUrl, fail: () => wx.switchTab({ url: '/pages/index/index' }) });
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
  },

  async uploadImages() {
    const tasks = this.data.images.map((path) => {
      if (path.startsWith('cloud://')) {
        return Promise.resolve(path);
      }
      const suffix = path.split('.').pop() || 'jpg';
      return wx.cloud.uploadFile({
        cloudPath: `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${suffix}`,
        filePath: path
      }).then((res) => res.fileID);
    });
    return Promise.all(tasks);
  }
});
