const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const targetType = event.targetType || 'post';
  const targetId = event.targetId;
  const reason = event.reason || '其他';
  if (!targetId) {
    throw new Error('举报对象不能为空');
  }

  const res = await db.collection('reports').add({
    data: {
      targetType,
      targetId,
      reason,
      detail: event.detail || '',
      _openid: OPENID,
      status: 'pending',
      createdAt: db.serverDate()
    }
  });
  return { id: res._id };
};
