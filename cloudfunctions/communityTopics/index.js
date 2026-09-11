const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function userOf(openid) {
  if (!openid) return null;
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return result.data[0] || null;
}

async function assertVerified(openid) {
  const user = await userOf(openid);
  if (!user) throw new Error('请先登录');
  if (user.banned) throw new Error('账号已被限制');
  if (!user.verified || user.role === 'merchant') throw new Error('完成业主认证后才能参与问题投票');
  return user;
}

async function checkText(openid, content) {
  try {
    await cloud.openapi.security.msgSecCheck({ version: 2, openid, scene: 2, content });
  } catch (error) {
    throw new Error('内容未通过安全检测');
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || 'list';

  if (action === 'list') {
    const viewer = await userOf(OPENID);
    const topics = await db.collection('community_topics')
      .where({ status: 'published' })
      .orderBy('voteCount', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    let voteIds = new Set();
    if (viewer && viewer.verified && !viewer.banned) {
      const votes = await db.collection('topic_votes').where({ _openid: OPENID }).limit(100).get();
      voteIds = new Set(votes.data.map((item) => item.topicId));
    }
    return { topics: topics.data.map((item) => Object.assign({}, item, { voted: voteIds.has(item._id) })) };
  }

  if (action === 'create') {
    const user = await assertVerified(OPENID);
    const title = String(event.title || '').trim().slice(0, 80);
    const content = String(event.content || '').trim().slice(0, 800);
    const category = ['delivery', 'renovation', 'community'].includes(event.category) ? event.category : 'delivery';
    if (!title || !content) throw new Error('请填写问题标题和说明');
    await checkText(OPENID, `${title}\n${content}`);
    const result = await db.collection('community_topics').add({
      data: { _openid: OPENID, authorId: user._id, authorName: user.nickName || '认证业主', title, content, category, voteCount: 0, status: 'published', createdAt: db.serverDate(), updatedAt: db.serverDate() }
    });
    return { ok: true, id: result._id };
  }

  if (action === 'toggleVote') {
    await assertVerified(OPENID);
    const topicId = String(event.id || '').trim();
    if (!topicId) throw new Error('问题不存在');
    const transaction = await db.startTransaction();
    try {
      const topic = await transaction.collection('community_topics').doc(topicId).get();
      if (!topic.data || topic.data.status !== 'published') throw new Error('该问题不可投票');
      const found = await transaction.collection('topic_votes').where({ topicId, _openid: OPENID }).limit(1).get();
      const voted = !found.data.length;
      if (voted) {
        await transaction.collection('topic_votes').add({ data: { topicId, _openid: OPENID, createdAt: db.serverDate() } });
        await transaction.collection('community_topics').doc(topicId).update({ data: { voteCount: _.inc(1), updatedAt: db.serverDate() } });
      } else {
        await transaction.collection('topic_votes').doc(found.data[0]._id).remove();
        await transaction.collection('community_topics').doc(topicId).update({ data: { voteCount: _.inc(-1), updatedAt: db.serverDate() } });
      }
      await transaction.commit();
      return { ok: true, voted };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  throw new Error('未知操作');
};
