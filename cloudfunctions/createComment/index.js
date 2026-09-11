const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  if (!res.data.length) throw new Error('请先登录');
  const user = res.data[0];
  if (!user.verified) throw new Error('请先完成社区认证');
  if (user.banned) throw new Error('账号已被限制');
  if (user.role === 'merchant') throw new Error('商家账号仅可在授权板块发帖');
  return user;
}

async function checkText(openid, content) {
  try {
    await cloud.openapi.security.msgSecCheck({
      version: 2,
      openid,
      scene: 2,
      content
    });
  } catch (error) {
    throw new Error('评论未通过安全检测');
  }
}

async function notify(openid, title, content, route) {
  if (!openid) return;
  try {
    await db.collection('notifications').add({ data: {
      _openid: openid,
      type: 'comment',
      title,
      content,
      route,
      read: false,
      createdAt: db.serverDate()
    } });
  } catch (error) { console.error('comment notification failed', error); }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const user = await getCurrentUser(OPENID);
  const content = String(event.content || '').trim();
  if (!content) throw new Error('评论不能为空');
  if (content.length > 500) throw new Error('评论过长');
  if (/1[3-9]\d{9}|\b\d{17}[\dXx]\b/.test(content)) throw new Error('评论中不能发布手机号或身份证号');
  await checkText(OPENID, content);

  const post = await db.collection('posts').doc(event.postId).get();
  if (post.data.status !== 'published') {
    throw new Error('帖子不可评论');
  }

  const res = await db.collection('comments').add({
    data: {
      postId: event.postId,
      _openid: OPENID,
      authorId: user._id,
      authorName: user.nickName || '社区邻居',
      content,
      parentId: event.parentId || '',
      status: 'published',
      createdAt: db.serverDate()
    }
  });
  await db.collection('posts').doc(event.postId).update({ data: { commentCount: _.inc(1) } });
  if (post.data._openid && post.data._openid !== OPENID) {
    await notify(post.data._openid, '你的帖子收到新评论', `“${String(post.data.title || '').slice(0, 24)}”有新的邻里互动。`, `/pages/detail/detail?id=${event.postId}`);
  }
  return { id: res._id };
};
