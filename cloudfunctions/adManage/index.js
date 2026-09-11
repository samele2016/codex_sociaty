const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function userOf(openid) {
  if (!openid) return null;
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return result.data[0] || null;
}
function clean(value, max) { return String(value || '').trim().slice(0, max); }
function isSystem(user) { return user && ['admin', 'system_admin'].includes(user.role) && !user.banned; }
function isValidDate(value) { return Boolean(value) && !Number.isNaN(new Date(value).getTime()); }
function isActiveCampaign(item, now) {
  const startAt = item.startAt ? new Date(item.startAt) : null;
  const endAt = item.endAt ? new Date(item.endAt) : null;
  return (!startAt || startAt <= now) && (!endAt || endAt >= now);
}

function todayKey() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function addAudit(data) {
  await db.collection('audit_logs').add({ data: Object.assign({ createdAt: db.serverDate() }, data) });
}

async function checkText(openid, content) {
  try {
    await cloud.openapi.security.msgSecCheck({ version: 2, openid, scene: 2, content });
  } catch (error) {
    throw new Error('广告内容未通过安全检测');
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || 'list';
  if (action === 'list') {
    const now = new Date();
    const result = await db.collection('ad_campaigns').where({ status: 'published' }).orderBy('pinned', 'desc').orderBy('createdAt', 'desc').limit(10).get();
    return { ads: result.data.filter((item) => isActiveCampaign(item, now)) };
  }
  const user = await userOf(OPENID);
  if (action === 'track') {
    const adId = clean(event.adId, 80);
    const eventType = clean(event.eventType, 20);
    if (!adId || !['impression', 'click'].includes(eventType)) throw new Error('广告事件无效');
    if (!user || user.banned) return { ok: true, tracked: false };
    const campaignResult = await db.collection('ad_campaigns').doc(adId).get();
    const campaign = campaignResult.data;
    if (!campaign || campaign.status !== 'published' || !isActiveCampaign(campaign, new Date())) return { ok: true, tracked: false };
    const dateKey = todayKey();
    const dedupeKey = `${adId}:${OPENID}:${dateKey}:${eventType}`;
    const transaction = await db.startTransaction();
    try {
      const existing = await transaction.collection('ad_events').where({ dedupeKey }).limit(1).get();
      if (!existing.data.length) {
        await transaction.collection('ad_events').add({ data: {
          dedupeKey,
          adId,
          eventType,
          dateKey,
          _openid: OPENID,
          createdAt: db.serverDate()
        } });
        const counter = eventType === 'impression' ? 'impressionCount' : 'clickCount';
        await transaction.collection('ad_campaigns').doc(adId).update({ data: { [counter]: _.inc(1), updatedAt: db.serverDate() } });
      }
      await transaction.commit();
      return { ok: true, tracked: !existing.data.length };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  if (!isSystem(user)) throw new Error('仅系统管理员可管理广告位');
  if (action === 'dashboard') {
    const result = await db.collection('ad_campaigns').orderBy('createdAt', 'desc').limit(50).get();
    return { ads: result.data };
  }
  if (action === 'save') {
    const title = clean(event.title, 100);
    const content = clean(event.content, 1000);
    if (!title || !content) throw new Error('广告标题和内容不能为空');
    const merchantId = clean(event.merchantId, 80);
    if (!merchantId) throw new Error('请选择已授权合作商家');
    const merchantResult = await db.collection('users').doc(merchantId).get();
    const merchant = merchantResult.data;
    if (!merchant || merchant.role !== 'merchant' || merchant.banned) throw new Error('只能为已授权合作商家创建广告位');
    const startAt = clean(event.startAt, 30);
    const endAt = clean(event.endAt, 30);
    if ((startAt && !isValidDate(startAt)) || (endAt && !isValidDate(endAt))) throw new Error('广告日期格式无效');
    if (startAt && endAt && new Date(endAt) < new Date(startAt)) throw new Error('结束时间不能早于开始时间');
    await checkText(OPENID, `${title}\n${content}`);
    const payload = { title, content, category: clean(event.category, 30) || '装修服务', position: clean(event.position, 30) || 'home', startAt, endAt, pinned: Boolean(event.pinned), status: event.status === 'draft' ? 'draft' : 'published', merchantId, merchantName: clean(merchant.merchantBusinessName || merchant.nickName, 80), updatedAt: db.serverDate() };
    if (!event.id) {
      payload.impressionCount = 0;
      payload.clickCount = 0;
    }
    const result = event.id ? await db.collection('ad_campaigns').doc(event.id).update({ data: payload }) : await db.collection('ad_campaigns').add({ data: Object.assign(payload, { createdAt: db.serverDate(), createdBy: OPENID }) });
    const id = event.id || result._id;
    await addAudit({ action: event.id ? 'updateAdCampaign' : 'createAdCampaign', targetType: 'ad_campaign', targetId: id, operatorOpenid: OPENID, after: { merchantId, status: payload.status, startAt, endAt } });
    return { ok: true, id };
  }
  if (action === 'remove') {
    await db.collection('ad_campaigns').doc(event.id).update({ data: { status: 'removed', updatedAt: db.serverDate() } });
    await addAudit({ action: 'removeAdCampaign', targetType: 'ad_campaign', targetId: event.id, operatorOpenid: OPENID, after: { status: 'removed' } });
    return { ok: true };
  }
  throw new Error('未知操作');
};
