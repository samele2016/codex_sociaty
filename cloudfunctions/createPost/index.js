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
const fieldLimits = { price: 80, place: 120, time: 120 };

function normalizedFields(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.keys(fieldLimits).reduce((result, key) => {
    const field = String(input[key] || '').trim().slice(0, fieldLimits[key]);
    if (field) result[key] = field;
    return result;
  }, {});
}

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  if (!res.data.length) throw new Error('请先登录');
  const user = res.data[0];
  if (!user.verified) throw new Error(user.verificationStatus === 'pending' ? '认证申请审核中' : '请先完成社区认证');
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

function imageContentType(fileId) {
  const path = String(fileId || '').split('?')[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function checkImages(fileIds) {
  for (const fileId of fileIds) {
    try {
      const file = await cloud.downloadFile({ fileID: fileId });
      await cloud.openapi.security.imgSecCheck({
        media: { contentType: imageContentType(fileId), value: file.fileContent }
      });
    } catch (error) {
      throw new Error('图片未通过安全检测，请更换后重试');
    }
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const user = await getCurrentUser(OPENID);
  const category = event.category;
  if (!categoryLabels[category]) {
    throw new Error('分类无效');
  }
  const role = user.role === 'member' ? 'owner' : user.role;
  if (role === 'merchant' && !(user.merchantCategories || []).includes(category)) {
    throw new Error('商家暂未获得该板块的发帖权限');
  }
  if (role === 'board_admin' && !(user.managedCategories || []).includes(category)) {
    throw new Error('板块管理员暂未获得该板块的发帖权限');
  }

  const title = String(event.title || '').trim();
  const content = String(event.content || '').trim();
  const contact = String(event.contact || '').trim().slice(0, 80);
  const fields = normalizedFields(event.fields);
  if (!title || !content) {
    throw new Error('标题和正文必填');
  }
  if (title.length > 40 || content.length > 1000) {
    throw new Error('内容长度超限');
  }
  if (/1[3-9]\d{9}|\b\d{17}[\dXx]\b/.test(`${title}\n${content}\n${Object.values(fields).join('\n')}`)) {
    throw new Error('公开内容不能包含手机号或身份证号，请填写在联系方式栏');
  }

  await checkText(OPENID, `${title}\n${content}\n${contact}\n${Object.values(fields).join('\n')}`);
  const rawImages = Array.isArray(event.images) ? event.images : [];
  const images = rawImages.filter((item) => typeof item === 'string' && item.startsWith('cloud://')).slice(0, 6);
  if (images.length !== rawImages.length || rawImages.length > 6) throw new Error('图片格式或数量无效');
  await checkImages(images);

  const authorType = role === 'merchant' ? 'merchant' : 'owner';
  const commercial = authorType === 'merchant' || ['ad', 'groupbuy'].includes(category);
  const needReview = reviewRequired.includes(category) || authorType === 'merchant' || Boolean(contact);
  const data = {
    _openid: OPENID,
    authorId: user._id,
    authorName: user.nickName || '社区邻居',
    authorType,
    commercial,
    category,
    categoryLabel: categoryLabels[category],
    title,
    content,
    images,
    fields,
    contact,
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
