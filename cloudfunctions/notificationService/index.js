const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function currentUser(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get();
  const user = result.data[0];
  if (!user || user.banned) throw new Error('账号暂不可用');
  return user;
}

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  await currentUser(OPENID);
  const action = event.action || 'mine';

  if (action === 'mine') {
    const [result, unread] = await Promise.all([
      db.collection('notifications').where({ _openid: OPENID }).orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('notifications').where({ _openid: OPENID, read: false }).count()
    ]);
    return { notifications: result.data, unreadCount: unread.total };
  }

  if (action === 'markRead') {
    const id = clean(event.id, 80);
    if (!id) throw new Error('缺少通知标识');
    const result = await db.collection('notifications').doc(id).get();
    const notification = result.data;
    if (!notification || notification._openid !== OPENID) throw new Error('无权操作该通知');
    if (!notification.read) {
      await db.collection('notifications').doc(id).update({ data: { read: true, readAt: db.serverDate() } });
    }
    return { ok: true };
  }

  if (action === 'markAllRead') {
    const result = await db.collection('notifications').where({ _openid: OPENID, read: false }).update({ data: { read: true, readAt: db.serverDate() } });
    return { ok: true, count: (result.stats || {}).updated || 0 };
  }

  throw new Error('未知操作');
};
