const { call } = require('../../utils/api');
const { categories } = require('../../utils/constants');

const privacyTypeText = {
  correction: '\u8d44\u6599\u66f4\u6b63',
  deletion: '\u6ce8\u9500\u4e0e\u5220\u9664',
  complaint: '\u9690\u79c1\u6216\u670d\u52a1\u6295\u8bc9'
};
const privacyStatusText = {
  pending: '\u5f85\u5904\u7406',
  resolved: '\u5df2\u5904\u7406',
  rejected: '\u5df2\u56de\u590d'
};
const merchantBoardOptions = categories.filter((item) => ['renovation', 'ad', 'groupbuy'].includes(item.key));
const agreementStatuses = [
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '履约中' },
  { value: 'completed', label: '已完成' },
  { value: 'refunded', label: '已退款' },
  { value: 'cancelled', label: '已取消' }
];

Page({
  data: {
    activePanel: 'overview',
    updates: [], documents: [], applications: [], merchants: [], requests: [], privacyRequests: [], ads: [], agreements: [], stats: null, merchantBoardOptions, agreementStatuses,
    updateForm: { title: '', content: '', source: '', coverage: '', version: 'v1.0', attachments: [] },
    documentForm: { title: '', type: '\u6237\u578b\u8d44\u6599', building: '\u5168\u793e\u533a', layout: '', source: '', coverage: '', version: 'v1.0', fileIds: [] },
    adForm: { title: '', content: '', category: '\u88c5\u4fee\u670d\u52a1', merchantId: '', merchantName: '', startAt: '', endAt: '' },
    revenueForm: { amount: '', type: '\u5e7f\u544a\u4f4d', note: '', requestId: '' },
    agreementForm: { id: '', merchantId: '', merchantName: '', title: '', serviceType: '广告包月', contractNo: '', serviceStart: '', serviceEnd: '', amount: '', paidAmount: '', refundAmount: '0', refundRule: '服务未开始可协商退款；已开始后按未履行服务期核算。', note: '', status: 'active' },
    agreementStatusIndex: 1,
    agreementStatusLabel: '履约中',
    loading: true,
    revenueSubmitting: false,
    accessDenied: false
  },

  onShow() { this.load(); },
  switchPanel(event) {
    this.setData({ activePanel: event.currentTarget.dataset.panel });
  },
  onInput(event) {
    const group = event.currentTarget.dataset.group;
    const key = event.currentTarget.dataset.key;
    this.setData({ [`${group}.${key}`]: event.detail.value });
  },
  async load() {
    this.setData({ loading: true });
    try {
      const [delivery, merchants, leads, privacy, ads, stats, commercial] = await Promise.all([
        call('deliveryHub', { action: 'dashboard' }),
        call('merchantApply', { action: 'dashboard' }),
        call('renovationLead', { action: 'dashboard' }),
        call('accountService', { action: 'dashboard' }),
        call('adManage', { action: 'dashboard' }),
        call('opsStats', { action: 'dashboard' }),
        call('opsStats', { action: 'commercialDashboard' })
      ]);
      const merchantOptions = merchants.merchants || [];
      const requests = (leads.requests || []).map((item) => Object.assign({}, item, {
        merchantOptions,
        selectedMerchantId: item.assignedMerchantId || '',
        selectedMerchantName: (merchantOptions.find((merchant) => merchant._id === item.assignedMerchantId) || {}).businessName || ''
      }));
      const privacyRequests = (privacy.requests || []).map((item) => Object.assign({}, item, {
        typeText: privacyTypeText[item.type] || item.type,
        statusText: privacyStatusText[item.status] || item.status
      }));
      this.setData({
        updates: delivery.updates || [],
        documents: delivery.documents || [],
        applications: (merchants.applications || []).map((item) => Object.assign({}, item, {
          selectedPostCategories: item.postCategories || ['renovation'],
          qualificationFiles: item.qualificationFiles || [],
          caseImages: item.caseImages || []
        })),
        merchants: merchantOptions,
        requests,
        privacyRequests,
        ads: ads.ads || [],
        agreements: commercial.agreements || [],
        stats
      });
    } catch (error) {
      const message = error.message || '\u52a0\u8f7d\u5931\u8d25';
      wx.showToast({ title: message, icon: 'none' });
      if (/\u65e0\u6743|\u6743\u9650|\u7ba1\u7406\u5458/.test(message)) {
        this.setData({ accessDenied: true });
        wx.switchTab({ url: '/pages/profile/profile' });
      }
    } finally {
      this.setData({ loading: false });
    }
  },
  async saveDelivery(event) {
    const type = event.currentTarget.dataset.type;
    const form = type === 'update' ? this.data.updateForm : this.data.documentForm;
    const action = type === 'update' ? 'saveUpdate' : 'saveDocument';
    try {
      await call('deliveryHub', Object.assign({ action }, form));
      wx.showToast({ title: '\u5df2\u4fdd\u5b58\u5e76\u53d1\u5e03', icon: 'success' });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '\u4fdd\u5b58\u5931\u8d25', icon: 'none' });
    }
  },
  async chooseFiles(event) {
    const type = event.currentTarget.dataset.type;
    try {
      const result = await new Promise((resolve, reject) => wx.chooseMessageFile({ count: 6, type: 'all', success: resolve, fail: reject }));
      const files = await Promise.all((result.tempFiles || []).map((file) => {
        const name = String(file.name || 'file').replace(/[^\w.-]/g, '_');
        return wx.cloud.uploadFile({ cloudPath: `delivery-materials/${Date.now()}-${Math.random().toString(16).slice(2)}-${name}`, filePath: file.path });
      }));
      const ids = files.map((file) => file.fileID);
      this.setData(type === 'update' ? { 'updateForm.attachments': ids } : { 'documentForm.fileIds': ids });
      wx.showToast({ title: `\u5df2\u4e0a\u4f20 ${ids.length} \u4efd`, icon: 'success' });
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) return;
      wx.showToast({ title: '\u9644\u4ef6\u4e0a\u4f20\u5931\u8d25', icon: 'none' });
    }
  },
  async reviewMerchant(event) {
    const application = this.data.applications.find((item) => item._id === event.currentTarget.dataset.id);
    const status = event.currentTarget.dataset.status;
    if (status === 'approved' && (!application || !application.selectedPostCategories.length)) {
      wx.showToast({ title: '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u53ef\u53d1\u5e03\u677f\u5757', icon: 'none' });
      return;
    }
    try {
      await call('merchantApply', { action: 'review', id: event.currentTarget.dataset.id, status, postCategories: application ? application.selectedPostCategories : [] });
      wx.showToast({ title: '\u5ba1\u6838\u72b6\u6001\u5df2\u66f4\u65b0', icon: 'success' });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '\u64cd\u4f5c\u5931\u8d25', icon: 'none' });
    }
  },
  onMerchantBoardChange(event) {
    const id = event.currentTarget.dataset.id;
    const selectedPostCategories = event.detail.value || [];
    this.setData({
      applications: this.data.applications.map((item) => item._id === id ? Object.assign({}, item, { selectedPostCategories }) : item)
    });
  },
  async updateLead(event) {
    try {
      await call('renovationLead', { action: 'updateStatus', id: event.currentTarget.dataset.id, status: event.currentTarget.dataset.status });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '\u66f4\u65b0\u5931\u8d25', icon: 'none' });
    }
  },
  onMerchantPickerChange(event) {
    const id = event.currentTarget.dataset.id;
    const request = this.data.requests.find((item) => item._id === id);
    if (!request) return;
    const merchant = request.merchantOptions[Number(event.detail.value)];
    if (merchant) {
      this.setData({
        requests: this.data.requests.map((item) => item._id === id
          ? Object.assign({}, item, { selectedMerchantId: merchant._id, selectedMerchantName: merchant.businessName || merchant.nickName })
          : item)
      });
    }
  },
  async assignLead(event) {
    const request = this.data.requests.find((item) => item._id === event.currentTarget.dataset.id);
    if (!request || !request.selectedMerchantId) {
      wx.showToast({ title: '\u8bf7\u5148\u9009\u62e9\u5546\u5bb6', icon: 'none' });
      return;
    }
    try {
      await call('renovationLead', { action: 'assign', id: request._id, merchantId: request.selectedMerchantId });
      wx.showToast({ title: '\u7ebf\u7d22\u5df2\u5206\u914d', icon: 'success' });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '\u5206\u914d\u5931\u8d25', icon: 'none' });
    }
  },
  async resolvePrivacy(event) {
    const { id, status } = event.currentTarget.dataset;
    try {
      await call('accountService', { action: 'resolve', id, status });
      wx.showToast({ title: status === 'resolved' ? '\u7533\u8bf7\u5df2\u5904\u7406' : '\u5df2\u5b8c\u6210\u56de\u590d', icon: 'success' });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '\u64cd\u4f5c\u5931\u8d25', icon: 'none' });
    }
  },
  async saveAd() {
    try {
      await call('adManage', Object.assign({ action: 'save' }, this.data.adForm));
      wx.showToast({ title: '\u5e7f\u544a\u4f4d\u5df2\u53d1\u5e03', icon: 'success' });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '\u4fdd\u5b58\u5931\u8d25', icon: 'none' });
    }
  },
  onAdMerchantChange(event) {
    const merchant = this.data.merchants[Number(event.detail.value)];
    if (!merchant) return;
    this.setData({ 'adForm.merchantId': merchant._id, 'adForm.merchantName': merchant.businessName || merchant.nickName });
  },
  async removeAd(event) {
    try {
      await call('adManage', { action: 'remove', id: event.currentTarget.dataset.id });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '\u4e0b\u67b6\u5931\u8d25', icon: 'none' });
    }
  },
  async saveRevenue() {
    if (this.data.revenueSubmitting) return;
    const requestId = this.data.revenueForm.requestId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.setData({ revenueSubmitting: true, 'revenueForm.requestId': requestId });
    try {
      await call('opsStats', Object.assign({ action: 'addRevenue', requestId }, this.data.revenueForm));
      wx.showToast({ title: '\u6536\u5165\u5df2\u8bb0\u8d26', icon: 'success' });
      this.setData({ 'revenueForm.amount': '', 'revenueForm.note': '', 'revenueForm.requestId': '' });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '\u8bb0\u8d26\u5931\u8d25', icon: 'none' });
    } finally {
      this.setData({ revenueSubmitting: false });
    }
  },
  onAgreementMerchantChange(event) {
    const merchant = this.data.merchants[Number(event.detail.value)];
    if (!merchant) return;
    this.setData({
      'agreementForm.merchantId': merchant._id,
      'agreementForm.merchantName': merchant.businessName || merchant.nickName
    });
  },
  onAgreementStatusChange(event) {
    const index = Number(event.detail.value);
    const status = agreementStatuses[index];
    if (!status) return;
    this.setData({ agreementStatusIndex: index, agreementStatusLabel: status.label, 'agreementForm.status': status.value });
  },
  editAgreement(event) {
    const agreement = this.data.agreements.find((item) => item._id === event.currentTarget.dataset.id);
    if (!agreement) return;
    const statusIndex = Math.max(0, agreementStatuses.findIndex((item) => item.value === agreement.status));
    this.setData({
      agreementStatusIndex: statusIndex,
      agreementStatusLabel: agreementStatuses[statusIndex].label,
      agreementForm: {
        id: agreement._id,
        merchantId: agreement.merchantId || '',
        merchantName: agreement.merchantName || '',
        title: agreement.title || '',
        serviceType: agreement.serviceType || '',
        contractNo: agreement.contractNo || '',
        serviceStart: agreement.serviceStart || '',
        serviceEnd: agreement.serviceEnd || '',
        amount: String(agreement.amount || ''),
        paidAmount: String(agreement.paidAmount || ''),
        refundAmount: String(agreement.refundAmount || 0),
        refundRule: agreement.refundRule || '',
        note: agreement.note || '',
        status: agreement.status || 'draft'
      }
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },
  async saveAgreement() {
    try {
      await call('opsStats', Object.assign({ action: 'saveCommercialRecord' }, this.data.agreementForm));
      wx.showToast({ title: this.data.agreementForm.id ? '合作记录已更新' : '合作记录已保存', icon: 'success' });
      this.setData({
        agreementStatusIndex: 1,
        agreementStatusLabel: '履约中',
        agreementForm: { id: '', merchantId: '', merchantName: '', title: '', serviceType: '广告包月', contractNo: '', serviceStart: '', serviceEnd: '', amount: '', paidAmount: '', refundAmount: '0', refundRule: '服务未开始可协商退款；已开始后按未履行服务期核算。', note: '', status: 'active' }
      });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    }
  }
});
