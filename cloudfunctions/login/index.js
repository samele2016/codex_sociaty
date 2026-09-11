const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const users = db.collection('users');
  const found = await users.where({ _openid: OPENID }).limit(1).get();
  const now = db.serverDate();

  if (found.data.length) {
    const user = found.data[0];
    await users.doc(user._id).update({ data: { updatedAt: now, lastActiveAt: now } });
    return { user: Object.assign({}, user, { lastActiveAt: now }) };
  }

  const user = {
    _openid: OPENID,
    nickName: '社区邻居',
    avatarUrl: '',
    verified: false,
    verificationStatus: 'unsubmitted',
    building: '',
    unit: '',
    role: 'owner',
    merchantCategories: [],
    banned: false,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now
  };
  const created = await users.add({ data: user });
  return { user: Object.assign({ _id: created._id }, user) };
};
