const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const collection = event.type === 'favorite' ? 'favorites' : 'likes';
  const countField = event.type === 'favorite' ? 'favoriteCount' : 'likeCount';
  const found = await db.collection(collection)
    .where({ postId: event.postId, _openid: OPENID })
    .limit(1)
    .get();

  if (found.data.length) {
    await db.collection(collection).doc(found.data[0]._id).remove();
    await db.collection('posts').doc(event.postId).update({ data: { [countField]: _.inc(-1) } });
    return { active: false };
  }

  await db.collection(collection).add({
    data: {
      postId: event.postId,
      _openid: OPENID,
      createdAt: db.serverDate()
    }
  });
  await db.collection('posts').doc(event.postId).update({ data: { [countField]: _.inc(1) } });
  return { active: true };
};
