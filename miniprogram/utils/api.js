function call(name, data = {}) {
  return wx.cloud.callFunction({ name, data }).then((res) => res.result);
}

function requireVerified(user) {
  if (!user || !user.verified) {
    wx.navigateTo({ url: '/pages/verify/verify' });
    return false;
  }
  if (user.banned) {
    wx.showToast({ title: '账号已被限制', icon: 'none' });
    return false;
  }
  return true;
}

module.exports = {
  call,
  requireVerified
};
