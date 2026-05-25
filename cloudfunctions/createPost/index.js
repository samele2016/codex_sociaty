const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const categoryLabels = {
  idle: '闲置',
  skill: '技能',
  partner: '搭子',
  renovation: '装修',
  ad: '广告',
  groupbuy: '团购',
  chat: '闲聊',
  help: '求助'
};
const reviewRequired = ['ad', 'groupbuy'];

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  if (!res.data.length) throw new Error('请先登录');
  const user = res.data[0];
  if (!user.verified) throw new Error('请先完成社区认证');
  if (user.banned) throw new Error('账号已被限制');
  return user;
}

async function checkText(openid, text) {
  if (!text) return;
  try {
    await cloud.openapi.security.msgSecCheck({
      version: 2,
      openid,
      scene: 2,
      content: text
    });
  } catch (error) {
    throw new Error('内容未通过安全检测');
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const user = await getCurrentUser(OPENID);
  const category = event.category;
  if (!categoryLabels[category]) {
    throw new Error('分类无效');
  }

  const title = String(event.title || '').trim();
  const content = String(event.content || '').trim();
  if (!title || !content) {
    throw new Error('标题和正文必填');
  }
  if (title.length > 40 || content.length > 1000) {
    throw new Error('内容长度超限');
  }

  await checkText(OPENID, `${title}\n${content}\n${event.contact || ''}`);

  const needReview = reviewRequired.includes(category);
  const data = {
    _openid: OPENID,
    authorId: user._id,
    authorName: user.nickName || '社区邻居',
    category,
    categoryLabel: categoryLabels[category],
    title,
    content,
    images: Array.isArray(event.images) ? event.images.slice(0, 6) : [],
    fields: event.fields || {},
    contact: String(event.contact || '').trim(),
    status: needReview ? 'pending' : 'published',
    auditStatus: needReview ? 'pending' : 'passed',
    auditReason: '',
    pinned: false,
    featured: false,
    solved: false,
    viewCount: 0,
    likeCount: 0,
    favoriteCount: 0,
    commentCount: 0,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };

  const res = await db.collection('posts').add({ data });
  return {
    id: res._id,
    status: data.status,
    message: needReview ? '该分类需要管理员审核，通过后会展示在广场。' : '内容已发布到邻里广场。'
  };
};
