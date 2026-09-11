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
const publicStatuses = ['published', 'solved', 'expired'];

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

async function getUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return res.data[0] || null;
}

function isSystemAdmin(user) {
  return user && ['admin', 'system_admin'].includes(user.role) && !user.banned;
}

function canManagePost(user, post) {
  return isSystemAdmin(user) || Boolean(
    user && !user.banned && user.role === 'board_admin' && (user.managedCategories || []).includes(post.category)
  );
}

function publicComment(comment) {
  return {
    _id: comment._id,
    postId: comment.postId,
    authorName: comment.authorName || '社区邻居',
    content: comment.content,
    parentId: comment.parentId || '',
    createdAt: comment.createdAt
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const id = event.id;
  const postRes = await db.collection('posts').doc(id).get();
  const post = postRes.data;
  const viewer = await getUser(OPENID);
  const isAuthor = post._openid === OPENID;
  const canManage = canManagePost(viewer, post);

  if (!publicStatuses.includes(post.status) && !isAuthor && !canManage) {
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
      _id: post._id,
      authorName: post.authorName || '社区邻居',
      authorType: post.authorType === 'merchant' ? 'merchant' : 'owner',
      commercial: Boolean(post.commercial),
      category: post.category,
      categoryLabel: post.categoryLabel,
      title: post.title,
      content: post.content,
      contact: canViewContact ? post.contact : '',
      images: post.images || [],
      fieldPairs: Object.keys(post.fields || {}).map((key) => ({ key, value: post.fields[key] })),
      status: post.status,
      statusText: statusText[post.status] || post.status,
      createdAtText: formatDate(post.createdAt),
      pinned: Boolean(post.pinned),
      featured: Boolean(post.featured),
      solved: Boolean(post.solved),
      viewCount: Number(post.viewCount || 0),
      likeCount: Number(post.likeCount || 0),
      favoriteCount: Number(post.favoriteCount || 0),
      commentCount: Number(post.commentCount || 0)
    },
    comments: commentRes.data.map(publicComment)
  };
};
