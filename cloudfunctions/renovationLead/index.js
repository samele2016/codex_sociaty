const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function getUser(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get();
  const user = result.data[0];
  if (!user || user.banned) throw new Error('\u8d26\u53f7\u6682\u4e0d\u53ef\u7528');
  return user;
}

function isAdmin(user) {
  return ['admin', 'system_admin'].includes(user.role) && !user.banned;
}

function isMerchant(user) {
  return user.role === 'merchant' && user.verified && !user.banned;
}

function text(value, max) {
  return String(value || '').trim().slice(0, max);
}

async function addAudit(data) {
  await db.collection('audit_logs').add({ data: Object.assign({ createdAt: db.serverDate() }, data) });
}

async function notify(openid, type, title, content, route) {
  if (!openid) return;
  try {
    await db.collection('notifications').add({ data: {
      _openid: openid,
      type,
      title,
      content,
      route,
      read: false,
      createdAt: db.serverDate()
    } });
  } catch (error) { console.error('lead notification failed', error); }
}

function merchantLeadView(assignment, request) {
  if (!request) return null;
  return {
    id: assignment._id,
    requestId: request._id,
    status: assignment.status,
    houseType: request.houseType || '',
    budget: request.budget || '',
    startDate: request.startDate || '',
    demand: request.demand || '',
    contactAuthorized: Boolean(request.contactAuthorized),
    contact: request.contactAuthorized ? request.contact || '' : '',
    createdAt: assignment.createdAt
  };
}

async function merchantLeads(user) {
  if (!isMerchant(user)) throw new Error('\u4ec5\u5df2\u6388\u6743\u5546\u5bb6\u53ef\u67e5\u770b\u670d\u52a1\u7ebf\u7d22');
  const assignments = await db.collection('lead_assignments')
    .where({ merchantId: user._id })
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  const requestIds = [...new Set(assignments.data.map((item) => item.requestId).filter(Boolean))];
  if (!requestIds.length) return { leads: [] };
  const requests = await db.collection('renovation_requests').where({ _id: _.in(requestIds) }).limit(50).get();
  const requestsById = new Map(requests.data.map((item) => [item._id, item]));
  return { leads: assignments.data.map((item) => merchantLeadView(item, requestsById.get(item.requestId))).filter(Boolean) };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const user = await getUser(OPENID);
  const action = event.action || 'mine';

  if (action === 'create') {
    if (!user.verified || !['owner', 'member'].includes(user.role)) throw new Error('\u5b8c\u6210\u4e1a\u4e3b\u8ba4\u8bc1\u540e\u624d\u53ef\u63d0\u4ea4\u88c5\u4fee\u9700\u6c42');
    const contactAuthorized = Boolean(event.contactAuthorized);
    const demand = text(event.demand, 1500);
    if (!demand) throw new Error('\u8bf7\u586b\u5199\u88c5\u4fee\u9700\u6c42');
    if (/1[3-9]\d{9}|\b\d{17}[\dXx]\b/.test(demand)) throw new Error('\u9700\u6c42\u63cf\u8ff0\u4e0d\u80fd\u5305\u542b\u624b\u673a\u53f7\u6216\u8eab\u4efd\u8bc1\u53f7');
    if (contactAuthorized && !text(event.contact, 100)) throw new Error('\u5df2\u6388\u6743\u8054\u7cfb\u65f6\uff0c\u8bf7\u586b\u5199\u8054\u7cfb\u65b9\u5f0f');
    const data = {
      _openid: OPENID,
      userId: user._id,
      houseType: text(event.houseType, 80),
      budget: text(event.budget, 80),
      startDate: text(event.startDate, 30),
      demand,
      contactAuthorized,
      status: 'new',
      source: text(event.source, 50) || 'renovation_service',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    if (contactAuthorized) {
      data.contact = text(event.contact, 100);
      data.authorizationAt = db.serverDate();
    }
    const result = await db.collection('renovation_requests').add({ data });
    await addAudit({ action: 'createRenovationLead', targetType: 'renovation_request', targetId: result._id, operatorOpenid: OPENID, after: { contactAuthorized } });
    return { ok: true, id: result._id };
  }

  if (action === 'mine') {
    const result = await db.collection('renovation_requests').where({ _openid: OPENID }).orderBy('createdAt', 'desc').limit(20).get();
    return { requests: result.data.map((item) => Object.assign({}, item, { contact: item.contactAuthorized ? item.contact : '' })) };
  }

  if (action === 'revokeContact') {
    const id = text(event.id, 80);
    if (!id) throw new Error('缺少装修需求标识');
    const requestResult = await db.collection('renovation_requests').doc(id).get();
    const request = requestResult.data;
    if (!request || request._openid !== OPENID) throw new Error('无权操作该装修需求');
    if (!request.contactAuthorized) return { ok: true, alreadyRevoked: true };
    await db.collection('renovation_requests').doc(id).update({ data: {
      contactAuthorized: false,
      contact: '',
      authorizationRevokedAt: db.serverDate(),
      updatedAt: db.serverDate()
    } });
    await addAudit({ action: 'revokeRenovationContactAuthorization', targetType: 'renovation_request', targetId: id, operatorOpenid: OPENID });
    const assignments = await db.collection('lead_assignments').where({ requestId: id, status: _.in(['assigned', 'accepted', 'contacted']) }).limit(20).get();
    const merchantIds = [...new Set(assignments.data.map((item) => item.merchantId).filter(Boolean))];
    if (merchantIds.length) {
      const merchants = await db.collection('users').where({ _id: _.in(merchantIds) }).limit(20).get();
      await Promise.all(merchants.data.map((merchant) => notify(merchant._openid, 'lead_authorization', '业主已撤回联系方式授权', '对应装修需求仍可查看摘要，但请勿再使用此前获得的联系方式。', '/pages/merchant-leads/merchant-leads')));
    }
    return { ok: true };
  }

  if (action === 'merchantMine') return merchantLeads(user);

  if (action === 'merchantUpdateStatus') {
    if (!isMerchant(user)) throw new Error('\u4ec5\u5df2\u6388\u6743\u5546\u5bb6\u53ef\u66f4\u65b0\u7ebf\u7d22\u72b6\u6001');
    const id = text(event.id, 80);
    const status = text(event.status, 30);
    if (!id || !['accepted', 'contacted', 'closed', 'declined'].includes(status)) throw new Error('\u7ebf\u7d22\u72b6\u6001\u65e0\u6548');
    const assignmentResult = await db.collection('lead_assignments').doc(id).get();
    const assignment = assignmentResult.data;
    if (!assignment || assignment.merchantId !== user._id) throw new Error('\u65e0\u6743\u64cd\u4f5c\u8be5\u7ebf\u7d22');
    if (['closed', 'declined'].includes(assignment.status)) throw new Error('\u8be5\u7ebf\u7d22\u5df2\u7ed3\u675f');
    if (status === 'closed' && assignment.status !== 'contacted') throw new Error('\u8bf7\u5148\u6807\u8bb0\u5df2\u8054\u7cfb\uff0c\u518d\u5b8c\u6210\u670d\u52a1');
    if (status === 'contacted') {
      const request = await db.collection('renovation_requests').doc(assignment.requestId).get();
      if (!request.data || !request.data.contactAuthorized) throw new Error('\u4e1a\u4e3b\u672a\u6388\u6743\u8054\u7cfb\uff0c\u4e0d\u53ef\u6807\u8bb0\u5df2\u8054\u7cfb');
    }
    await db.collection('lead_assignments').doc(id).update({ data: { status, updatedAt: db.serverDate() } });
    if (status === 'contacted' || status === 'closed') {
      await db.collection('renovation_requests').doc(assignment.requestId).update({ data: { status, updatedAt: db.serverDate() } });
    }
    if (status === 'declined') {
      await db.collection('renovation_requests').doc(assignment.requestId).update({ data: { status: 'new', assignedMerchantId: '', updatedAt: db.serverDate() } });
    }
    await addAudit({ action: 'merchantUpdateLeadStatus', targetType: 'lead_assignment', targetId: id, operatorOpenid: OPENID, after: { status, requestId: assignment.requestId } });
    return { ok: true };
  }

  if (!isAdmin(user)) throw new Error('\u9700\u8981\u7ba1\u7406\u5458\u6743\u9650');
  if (action === 'dashboard') {
    const result = await db.collection('renovation_requests').orderBy('createdAt', 'desc').limit(100).get();
    return { requests: result.data };
  }
  if (action === 'updateStatus') {
    const status = ['new', 'assigned', 'contacted', 'closed'].includes(event.status) ? event.status : 'new';
    await db.collection('renovation_requests').doc(event.id).update({ data: { status, updatedAt: db.serverDate() } });
    await addAudit({ action: 'adminUpdateLeadStatus', targetType: 'renovation_request', targetId: event.id, operatorOpenid: OPENID, after: { status } });
    return { ok: true };
  }
  if (action === 'assign') {
    const merchantId = text(event.merchantId, 80);
    const requestId = text(event.id, 80);
    if (!merchantId || !requestId) throw new Error('\u8bf7\u9009\u62e9\u5546\u5bb6\u548c\u7ebf\u7d22');
    const [merchantResult, requestResult] = await Promise.all([
      db.collection('users').doc(merchantId).get(),
      db.collection('renovation_requests').doc(requestId).get()
    ]);
    const merchant = merchantResult.data;
    const request = requestResult.data;
    if (!merchant || !isMerchant(merchant)) throw new Error('\u53ea\u80fd\u5206\u914d\u7ed9\u5df2\u6388\u6743\u5546\u5bb6');
    if (!request || !request.contactAuthorized) throw new Error('\u4e1a\u4e3b\u672a\u6388\u6743\u8054\u7cfb\uff0c\u4e0d\u53ef\u5206\u914d\u7ed9\u5546\u5bb6');
    const active = await db.collection('lead_assignments').where({
      requestId,
      merchantId,
      status: _.in(['assigned', 'accepted', 'contacted'])
    }).limit(1).get();
    if (active.data.length) throw new Error('\u8be5\u7ebf\u7d22\u5df2\u5206\u914d\u7ed9\u8be5\u5546\u5bb6');
    const assignment = await db.collection('lead_assignments').add({ data: {
      requestId,
      merchantId,
      assignedBy: OPENID,
      status: 'assigned',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    } });
    await db.collection('renovation_requests').doc(requestId).update({ data: { status: 'assigned', assignedMerchantId: merchantId, updatedAt: db.serverDate() } });
    await addAudit({ action: 'assignRenovationLead', targetType: 'lead_assignment', targetId: assignment._id, operatorOpenid: OPENID, after: { requestId, merchantId } });
    await notify(merchant._openid, 'renovation_lead', '你收到一条装修服务线索', '请先查看需求摘要并按平台规则跟进；只有业主授权时才能看到联系方式。', '/pages/merchant-leads/merchant-leads');
    return { ok: true, id: assignment._id };
  }
  throw new Error('\u672a\u77e5\u64cd\u4f5c');
};
