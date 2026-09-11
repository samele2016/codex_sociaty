const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function getEligibleUser(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get();
  const user = result.data[0];
  if (!user) throw new Error('请先登录');
  if (user.banned) throw new Error('账号已被限制');
  if (!user.verified) throw new Error('请先完成社区认证');
  return user;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  await getEligibleUser(OPENID);

  const type = event.type;
  if (!['like', 'favorite'].includes(type)) throw new Error('互动类型无效');
  const postId = String(event.postId || '').trim();
  if (!postId) throw new Error('帖子不存在');
  const collection = type === 'favorite' ? 'favorites' : 'likes';
  const countField = type === 'favorite' ? 'favoriteCount' : 'likeCount';
  const transaction = await db.startTransaction();

  try {
    const postResult = await transaction.collection('posts').doc(postId).get();
    if (!postResult.data || postResult.data.status !== 'published') throw new Error('帖子不可互动');

    const found = await transaction.collection(collection)
      .where({ postId, _openid: OPENID })
      .limit(1)
      .get();

    let active;
    if (found.data.length) {
      await transaction.collection(collection).doc(found.data[0]._id).remove();
      await transaction.collection('posts').doc(postId).update({ data: { [countField]: _.inc(-1) } });
      active = false;
    } else {
      await transaction.collection(collection).add({
        data: { postId, _openid: OPENID, createdAt: db.serverDate() }
      });
      await transaction.collection('posts').doc(postId).update({ data: { [countField]: _.inc(1) } });
      active = true;
    }
    await transaction.commit();
    return { active };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
