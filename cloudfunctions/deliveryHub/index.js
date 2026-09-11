const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const PUBLIC_STATUS = 'published';

function isAdmin(user) {
  return user && !user.banned && ['admin', 'system_admin'].includes(user.role);
}

async function currentUser(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return result.data[0] || null;
}

function clean(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function communityName(value) {
  const normalized = clean(value, 80).replace(/悦仕府/g, '阅仕府');
  return !normalized || /[?？�]{2,}/.test(normalized) ? '阅仕府微社区' : normalized;
}

function rejectSensitive(value) {
  const text = String(value || '');
  if (/1[3-9]\d{9}/.test(text) || /\b\d{17}[\dXx]\b/.test(text)) {
    throw new Error('资料正文不能包含手机号或身份证号，请先脱敏');
  }
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean).slice(0, 20) : [];
}

async function audit(openid, action, targetType, targetId, after) {
  await db.collection('audit_logs').add({ data: {
    action, targetType, targetId, operatorOpenid: openid, after: after || {}, createdAt: db.serverDate()
  } });
}

async function publicOverview() {
  const [updates, documents, community] = await Promise.all([
    db.collection('delivery_updates').where({ status: PUBLIC_STATUS }).orderBy('publishedAt', 'desc').limit(20).get(),
    db.collection('delivery_documents').where({ status: PUBLIC_STATUS }).orderBy('updatedAt', 'desc').limit(40).get(),
    db.collection('communities').limit(1).get()
  ]);
  const config = community.data[0] || {};
  return {
    deliveryDate: config.deliveryDate || '2027-04-01',
    communityName: communityName(config.name),
    updates: updates.data,
    documents: documents.data
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || 'overview';
  if (action === 'overview') return publicOverview();

  const operator = await currentUser(OPENID);
  if (!isAdmin(operator)) throw new Error('需要管理员权限');

  if (action === 'dashboard') {
    const [updates, documents] = await Promise.all([
      db.collection('delivery_updates').orderBy('updatedAt', 'desc').limit(50).get(),
      db.collection('delivery_documents').orderBy('updatedAt', 'desc').limit(50).get()
    ]);
    return { updates: updates.data, documents: documents.data };
  }

  if (action === 'saveUpdate') {
    const payload = {
      title: clean(event.title, 120),
      content: clean(event.content, 5000),
      buildings: normalizeList(event.buildings),
      source: clean(event.source, 300),
      sourceType: clean(event.sourceType, 50) || '工程方公开信息',
      version: clean(event.version, 50) || 'v1.0',
      coverage: clean(event.coverage, 200),
      attachments: normalizeList(event.attachments),
      status: event.status === 'draft' ? 'draft' : PUBLIC_STATUS,
      publishedBy: OPENID,
      publishedAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    if (!payload.title || !payload.content || !payload.source) throw new Error('标题、内容和来源不能为空');
    rejectSensitive(payload.content);
    const result = event.id
      ? await db.collection('delivery_updates').doc(event.id).update({ data: payload })
      : await db.collection('delivery_updates').add({ data: Object.assign(payload, { createdAt: db.serverDate() }) });
    const id = event.id || result._id;
    await audit(OPENID, 'saveDeliveryUpdate', 'delivery_update', id, payload);
    return { ok: true, id };
  }

  if (action === 'saveDocument') {
    const payload = {
      title: clean(event.title, 120),
      type: clean(event.type, 50) || '交付资料',
      building: clean(event.building, 50) || '全社区',
      layout: clean(event.layout, 80),
      source: clean(event.source, 300),
      version: clean(event.version, 50) || 'v1.0',
      coverage: clean(event.coverage, 200),
      fileIds: normalizeList(event.fileIds),
      status: event.status === 'draft' ? 'draft' : PUBLIC_STATUS,
      publishedBy: OPENID,
      updatedAt: db.serverDate()
    };
    if (!payload.title || !payload.source) throw new Error('资料名称和来源不能为空');
    rejectSensitive(JSON.stringify(payload));
    const result = event.id
      ? await db.collection('delivery_documents').doc(event.id).update({ data: payload })
      : await db.collection('delivery_documents').add({ data: Object.assign(payload, { createdAt: db.serverDate() }) });
    const id = event.id || result._id;
    await audit(OPENID, 'saveDeliveryDocument', 'delivery_document', id, payload);
    return { ok: true, id };
  }

  if (action === 'remove') {
    const collection = event.type === 'document' ? 'delivery_documents' : 'delivery_updates';
    await db.collection(collection).doc(event.id).update({ data: { status: 'removed', updatedAt: db.serverDate() } });
    await audit(OPENID, 'removeDeliveryContent', collection, event.id, { status: 'removed' });
    return { ok: true };
  }

  throw new Error('未知操作');
};
