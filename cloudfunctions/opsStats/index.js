const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const agreementStatuses = ['draft', 'active', 'completed', 'refunded', 'cancelled'];

async function adminOf(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get();
  const user = result.data[0];
  if (!user || user.banned || !['admin', 'system_admin'].includes(user.role)) throw new Error('需要系统管理员权限');
  return user;
}

function text(value, max) {
  return String(value || '').trim().slice(0, max);
}

function money(value, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`请输入有效${label}`);
  return Math.round(amount * 100) / 100;
}

async function sumAll(collectionName, where, reducer) {
  const pageSize = 100;
  const countResult = await db.collection(collectionName).where(where).count();
  let total = 0;
  for (let offset = 0; offset < countResult.total; offset += pageSize) {
    const page = await db.collection(collectionName).where(where).skip(offset).limit(pageSize).get();
    total += page.data.reduce(reducer, 0);
  }
  return total;
}

function date(value, label) {
  const normalized = text(value, 10);
  if (normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`${label}格式应为 YYYY-MM-DD`);
  return normalized;
}

async function addAudit(data) {
  await db.collection('audit_logs').add({ data: Object.assign({ createdAt: db.serverDate() }, data) });
}

async function commercialDashboard() {
  const result = await db.collection('merchant_agreements').orderBy('updatedAt', 'desc').limit(100).get();
  return { agreements: result.data };
}

async function saveCommercialRecord(event, openid) {
  const id = text(event.id, 80);
  const merchantId = text(event.merchantId, 80);
  if (!merchantId) throw new Error('请选择合作商家');
  const merchantResult = await db.collection('users').doc(merchantId).get();
  const merchant = merchantResult.data;
  if (!merchant || merchant.role !== 'merchant' || merchant.banned) throw new Error('只能选择已授权的合作商家');

  const title = text(event.title, 80);
  const serviceType = text(event.serviceType, 40);
  const status = text(event.status, 20) || 'draft';
  const contractNo = text(event.contractNo, 80);
  const refundRule = text(event.refundRule, 600);
  const note = text(event.note, 600);
  const serviceStart = date(event.serviceStart, '服务开始日期');
  const serviceEnd = date(event.serviceEnd, '服务结束日期');
  const amount = money(event.amount, '合同金额');
  const paidAmount = money(event.paidAmount, '实收金额');
  const refundAmount = money(event.refundAmount, '退款金额');

  if (!title || !serviceType) throw new Error('请填写合作项目和服务类型');
  if (amount <= 0) throw new Error('合同金额必须大于 0');
  if (!agreementStatuses.includes(status)) throw new Error('合作状态无效');
  if (!contractNo) throw new Error('请填写合同或订单编号');
  if (!refundRule) throw new Error('请填写退款规则');
  if (serviceStart && serviceEnd && serviceEnd < serviceStart) throw new Error('服务结束日期不能早于开始日期');
  if (paidAmount > amount) throw new Error('实收金额不能高于合同金额');
  if (refundAmount > paidAmount) throw new Error('退款金额不能高于实收金额');
  if (status === 'refunded' && refundAmount <= 0) throw new Error('已退款记录需填写退款金额');

  const data = {
    merchantId,
    merchantName: text(merchant.businessName || merchant.nickName, 80),
    title,
    serviceType,
    contractNo,
    serviceStart,
    serviceEnd,
    amount,
    amountCents: Math.round(amount * 100),
    paidAmount,
    paidAmountCents: Math.round(paidAmount * 100),
    refundAmount,
    refundAmountCents: Math.round(refundAmount * 100),
    refundRule,
    note,
    status,
    updatedAt: db.serverDate()
  };

  if (id) {
    const beforeResult = await db.collection('merchant_agreements').doc(id).get();
    if (!beforeResult.data) throw new Error('合作记录不存在');
    await db.collection('merchant_agreements').doc(id).update({ data });
    await addAudit({ action: 'updateMerchantAgreement', targetType: 'merchant_agreement', targetId: id, operatorOpenid: openid, before: beforeResult.data, after: data });
    return { ok: true, id };
  }

  data.createdBy = openid;
  data.createdAt = db.serverDate();
  const result = await db.collection('merchant_agreements').add({ data });
  await addAudit({ action: 'createMerchantAgreement', targetType: 'merchant_agreement', targetId: result._id, operatorOpenid: openid, after: data });
  return { ok: true, id: result._id };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  await adminOf(OPENID);
  const action = event.action || 'dashboard';

  if (action === 'addRevenue') {
    const amount = money(event.amount, '金额');
    if (amount <= 0) throw new Error('金额必须大于 0');
    const requestId = text(event.requestId, 100);
    if (!requestId) throw new Error('缺少记账请求标识');
    const existing = await db.collection('revenue_logs').where({ createdBy: OPENID, requestId }).limit(1).get();
    if (existing.data.length) return { ok: true, id: existing.data[0]._id, duplicated: true };
    const result = await db.collection('revenue_logs').add({ data: {
      merchantId: text(event.merchantId, 80),
      agreementId: text(event.agreementId, 80),
      type: text(event.type, 30) || '广告位',
      amount,
      amountCents: Math.round(amount * 100),
      requestId,
      note: text(event.note, 300),
      status: text(event.status, 20) || 'paid',
      createdBy: OPENID,
      createdAt: db.serverDate()
    } });
    await addAudit({ action: 'addRevenueLog', targetType: 'revenue_log', targetId: result._id, operatorOpenid: OPENID, after: { amount, type: text(event.type, 30) || '广告位' } });
    return { ok: true, id: result._id };
  }

  if (action === 'commercialDashboard') return commercialDashboard();
  if (action === 'saveCommercialRecord') return saveCommercialRecord(event, OPENID);
  if (action !== 'dashboard') throw new Error('未知操作');

  const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [users, verified, activeUsers, requests, effectiveLeads, merchants, ads, adImpressions, adClicks, revenueCents, agreements] = await Promise.all([
    db.collection('users').count(),
    sumAll('users', { verified: true }, (sum, item) => sum + (['owner', 'member', 'board_admin'].includes(item.role) ? 1 : 0)),
    db.collection('users').where({ lastActiveAt: _.gte(activeSince) }).count(),
    db.collection('renovation_requests').count(),
    db.collection('lead_assignments').where({ status: _.in(['contacted', 'closed']) }).count(),
    db.collection('users').where({ role: 'merchant', verified: true }).count(),
    db.collection('ad_campaigns').where({ status: 'published' }).count(),
    sumAll('ad_campaigns', { status: 'published' }, (sum, item) => sum + Number(item.impressionCount || 0)),
    sumAll('ad_campaigns', { status: 'published' }, (sum, item) => sum + Number(item.clickCount || 0)),
    sumAll('revenue_logs', { status: 'paid' }, (sum, item) => sum + Number(item.amountCents != null ? item.amountCents : Math.round(Number(item.amount || 0) * 100))),
    db.collection('merchant_agreements').where({ status: 'active' }).count()
  ]);
  return {
    users: users.total,
    verifiedOwners: verified,
    monthlyActiveUsers: activeUsers.total,
    renovationRequests: requests.total,
    effectiveLeads: effectiveLeads.total,
    merchants: merchants.total,
    activeAds: ads.total,
    activeAgreements: agreements.total,
    adImpressions,
    adClicks,
    revenue: revenueCents / 100
  };
};
