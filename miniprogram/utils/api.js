function call(name, data = {}) {
  return wx.cloud.callFunction({ name, data }).then((res) => res.result);
}

function requireVerified(user, options = {}) {
  if (!user) {
    wx.showToast({ title: '登录状态获取失败，请重试', icon: 'none' });
    return false;
  }
  if (!user.verified) {
    if (user.verificationStatus === 'pending') {
      wx.showToast({ title: '认证审核中，请等待管理员通过', icon: 'none' });
      return false;
    }
    const returnUrl = options.returnUrl ? `?returnUrl=${encodeURIComponent(options.returnUrl)}` : '';
    wx.navigateTo({ url: `/pages/verify/verify${returnUrl}` });
    return false;
  }
  if (user.banned) {
    wx.showToast({ title: '账号已被限制', icon: 'none' });
    return false;
  }
  return true;
}

function requireResident(user, options = {}) {
  if (!requireVerified(user, options)) return false;
  if (user.role === 'merchant') {
    wx.showToast({
      title: options.merchantMessage || '商家账号不能参与邻里互动',
      icon: 'none'
    });
    return false;
  }
  return true;
}

module.exports = {
  call,
  requireVerified,
  requireResident
};
