const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const statusText = {
  pending: '待审核',
  published: '已发布',
  removed: '已下架',
  solved: '已解决',
  expired: '已过期'
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

async function getUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return res.data[0] || null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const id = event.id;
  const postRes = await db.collection('posts').doc(id).get();
  const post = postRes.data;
  const viewer = await getUser(OPENID);
  const isAuthor = post._openid === OPENID;
  const isAdmin = viewer && viewer.role === 'admin';

  if (post.status !== 'published' && !isAuthor && !isAdmin) {
    throw new Error('帖子不可见');
  }

  await db.collection('posts').doc(id).update({ data: { viewCount: _.inc(1) } });

  const commentRes = await db.collection('comments')
    .where({ postId: id, status: 'published' })
    .orderBy('createdAt', 'asc')
    .limit(50)
    .get();

  const canViewContact = event.withContact && viewer && viewer.verified && !viewer.banned;
  if (event.withContact && canViewContact) {
    await db.collection('contact_logs').add({
      data: {
        postId: id,
        viewerOpenid: OPENID,
        authorOpenid: post._openid,
        createdAt: db.serverDate()
      }
    });
  }

  return {
    post: {
      ...post,
      contact: canViewContact ? post.contact : '',
      images: post.images || [],
      fieldPairs: Object.keys(post.fields || {}).map((key) => ({ key, value: post.fields[key] })),
      statusText: statusText[post.status] || post.status,
      createdAtText: formatDate(post.createdAt)
    },
    comments: commentRes.data
  };
};
