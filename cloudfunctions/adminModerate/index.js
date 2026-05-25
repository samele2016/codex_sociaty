const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function assertAdmin(openid) {
  const res = await db.collection('users').where({ _openid: openid, role: 'admin', banned: false }).limit(1).get();
  if (!res.data.length) {
    throw new Error('需要管理员权限');
  }
  return res.data[0];
}

async function log(action, targetType, targetId, openid, reason, after) {
  await db.collection('audit_logs').add({
    data: {
      action,
      targetType,
      targetId,
      operatorOpenid: openid,
      reason: reason || '',
      after: after || {},
      createdAt: db.serverDate()
    }
  });
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  await assertAdmin(OPENID);
  const action = event.action || 'dashboard';

  if (action === 'dashboard') {
    const pendingPosts = await db.collection('posts').where({ status: 'pending' }).orderBy('createdAt', 'asc').limit(20).get();
    const reports = await db.collection('reports').where({ status: 'pending' }).orderBy('createdAt', 'asc').limit(20).get();
    const users = await db.collection('users').count();
    return {
      pendingPosts: pendingPosts.data,
      reports: reports.data,
      stats: {
        pending: pendingPosts.data.length,
        reports: reports.data.length,
        users: users.total
      }
    };
  }

  const postActions = {
    approvePost: { status: 'published', auditStatus: 'passed', auditReason: '' },
    removePost: { status: 'removed', auditStatus: 'removed' },
    featurePost: { featured: true },
    pinPost: { pinned: true }
  };

  if (postActions[action]) {
    await db.collection('posts').doc(event.targetId).update({
      data: Object.assign({}, postActions[action], { updatedAt: db.serverDate() })
    });
    await log(action, 'post', event.targetId, OPENID, event.reason, postActions[action]);
    return { ok: true };
  }

  if (action === 'resolveReport') {
    await db.collection('reports').doc(event.targetId).update({
      data: {
        status: 'resolved',
        handledAt: db.serverDate(),
        handlerOpenid: OPENID
      }
    });
    await log(action, 'report', event.targetId, OPENID, event.reason, { linkedTargetId: event.linkedTargetId });
    return { ok: true };
  }

  if (action === 'banUser') {
    await db.collection('users').doc(event.targetId).update({ data: { banned: true, updatedAt: db.serverDate() } });
    await log(action, 'user', event.targetId, OPENID, event.reason, { banned: true });
    return { ok: true };
  }

  throw new Error('未知管理操作');
};
