const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const requestTypes = ['correction', 'deletion', 'complaint'];
const requestStatuses = ['pending', 'resolved', 'rejected'];

async function currentUser(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get();
  const user = result.data[0];
  if (!user) throw new Error('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u63d0\u4ea4\u7533\u8bf7');
  if (user.banned) throw new Error('\u8d26\u53f7\u5df2\u88ab\u9650\u5236');
  return user;
}

function requireSystemAdmin(user) {
  if (!['admin', 'system_admin'].includes(user.role)) throw new Error('\u4ec5\u7cfb\u7edf\u7ba1\u7406\u5458\u53ef\u5904\u7406\u8d26\u53f7\u4e0e\u9690\u79c1\u7533\u8bf7');
}

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

async function addAudit(data) {
  await db.collection('audit_logs').add({ data: Object.assign({ createdAt: db.serverDate() }, data) });
}

async function notify(openid, title, content) {
  if (!openid) return;
  try {
    await db.collection('notifications').add({ data: {
      _openid: openid,
      type: 'privacy_request',
      title,
      content,
      route: '/pages/privacy/privacy',
      read: false,
      createdAt: db.serverDate()
    } });
  } catch (error) { console.error('privacy notification failed', error); }
}

async function dashboard() {
  const result = await db.collection('privacy_requests').orderBy('createdAt', 'desc').limit(100).get();
  const userIds = [...new Set(result.data.map((item) => item.userId).filter(Boolean))];
  const users = userIds.length
    ? await db.collection('users').where({ _id: _.in(userIds) }).limit(100).get()
    : { data: [] };
  const usersById = new Map(users.data.map((item) => [item._id, item]));
  return {
    requests: result.data.map((item) => {
      const owner = usersById.get(item.userId) || {};
      return Object.assign({}, item, {
        ownerName: owner.nickName || '\u672a\u547d\u540d\u4e1a\u4e3b',
        ownerHouseNumber: owner.houseNumber || ''
      });
    })
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const user = await currentUser(OPENID);
  const action = event.action || 'mine';

  if (action === 'mine') {
    const result = await db.collection('privacy_requests')
      .where({ _openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    return { requests: result.data };
  }

  if (action === 'submit') {
    const type = clean(event.type, 30);
    const content = clean(event.content, 800);
    if (!requestTypes.includes(type)) throw new Error('\u7533\u8bf7\u7c7b\u578b\u65e0\u6548');
    if (!content) throw new Error('\u8bf7\u586b\u5199\u7533\u8bf7\u8bf4\u660e');

    const pending = await db.collection('privacy_requests')
      .where({ _openid: OPENID, type, status: 'pending' })
      .limit(1)
      .get();
    if (pending.data.length) throw new Error('\u5df2\u6709\u540c\u7c7b\u7533\u8bf7\u6b63\u5728\u5904\u7406\u4e2d');

    const result = await db.collection('privacy_requests').add({
      data: {
        _openid: OPENID,
        userId: user._id,
        type,
        content,
        status: 'pending',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    await addAudit({
      action: 'submitPrivacyRequest',
      targetType: 'privacy_request',
      targetId: result._id,
      operatorOpenid: OPENID,
      after: { type, status: 'pending' }
    });
    return { ok: true, id: result._id };
  }

  requireSystemAdmin(user);
  if (action === 'dashboard') return dashboard();

  if (action === 'resolve') {
    const id = clean(event.id, 80);
    const status = clean(event.status, 30);
    const handlerNote = clean(event.handlerNote, 800);
    if (!id) throw new Error('\u8bf7\u9009\u62e9\u9700\u5904\u7406\u7684\u7533\u8bf7');
    if (!['resolved', 'rejected'].includes(status)) throw new Error('\u5904\u7406\u72b6\u6001\u65e0\u6548');

    const result = await db.collection('privacy_requests').doc(id).get();
    const request = result.data;
    if (!request || !requestStatuses.includes(request.status)) throw new Error('\u7533\u8bf7\u4e0d\u5b58\u5728');
    if (request.status !== 'pending') throw new Error('\u8be5\u7533\u8bf7\u5df2\u7ecf\u5904\u7406');

    await db.collection('privacy_requests').doc(id).update({
      data: {
        status,
        handlerNote,
        handledBy: OPENID,
        handledAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    await addAudit({
      action: 'resolvePrivacyRequest',
      targetType: 'privacy_request',
      targetId: id,
      operatorOpenid: OPENID,
      before: { status: request.status },
      after: { status, handlerNote }
    });
    await notify(request._openid, status === 'resolved' ? '账号与隐私申请已处理' : '账号与隐私申请已有回复', handlerNote || (status === 'resolved' ? '运营人员已完成处理。' : '运营人员暂不受理该申请。'));
    return { ok: true };
  }

  throw new Error('\u672a\u77e5\u64cd\u4f5c');
};
