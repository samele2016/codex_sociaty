const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function getEligibleUser(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get();
  const user = result.data[0];
  if (!user) throw new Error('请先登录');
  if (user.banned) throw new Error('账号已被限制');
  if (!user.verified) throw new Error('请先完成社区认证');
  return user;
}

async function assertReportableTarget(targetType, targetId) {
  if (targetType === 'post') {
    const post = await db.collection('posts').doc(targetId).get();
    if (!post.data || post.data.status !== 'published') throw new Error('举报对象不可用');
    return;
  }
  if (targetType === 'comment') {
    const comment = await db.collection('comments').doc(targetId).get();
    if (!comment.data || comment.data.status !== 'published') throw new Error('举报对象不可用');
    const post = await db.collection('posts').doc(comment.data.postId).get();
    if (!post.data || post.data.status !== 'published') throw new Error('举报对象不可用');
    return;
  }
  throw new Error('举报类型无效');
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  await getEligibleUser(OPENID);

  const targetType = event.targetType || 'post';
  const targetId = String(event.targetId || '').trim();
  const reason = String(event.reason || '其他').trim().slice(0, 50);
  const detail = String(event.detail || '').trim().slice(0, 300);
  if (!targetId) throw new Error('举报对象不能为空');
  await assertReportableTarget(targetType, targetId);

  const existing = await db.collection('reports')
    .where({ targetType, targetId, _openid: OPENID, status: 'pending' })
    .limit(1)
    .get();
  if (existing.data.length) return { id: existing.data[0]._id, duplicated: true };

  const result = await db.collection('reports').add({
    data: {
      targetType,
      targetId,
      reason,
      detail,
      _openid: OPENID,
      status: 'pending',
      createdAt: db.serverDate()
    }
  });
  return { id: result._id };
};
