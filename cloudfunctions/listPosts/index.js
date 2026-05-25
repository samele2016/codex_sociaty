const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const page = Math.max(Number(event.page || 0), 0);
  const pageSize = Math.min(Math.max(Number(event.pageSize || 12), 1), 30);
  const where = event.mine
    ? { _openid: OPENID }
    : { status: 'published' };

  if (event.category && event.category !== 'all') {
    where.category = event.category;
  }
  if (event.keyword) {
    const keyword = db.RegExp({ regexp: String(event.keyword).trim(), options: 'i' });
    where.title = keyword;
  }

  let query = db.collection('posts').where(where).orderBy('pinned', 'desc');
  query = event.sort === 'recommended'
    ? query.orderBy('featured', 'desc').orderBy('likeCount', 'desc').orderBy('createdAt', 'desc')
    : query.orderBy('createdAt', 'desc');

  const res = await query.skip(page * pageSize).limit(pageSize + 1).get();
  const posts = res.data.slice(0, pageSize).map((post) => ({
    ...post,
    content: post.content.length > 120 ? `${post.content.slice(0, 120)}...` : post.content,
    images: post.images || []
  }));

  let summary = null;
  if (event.mine) {
    const mineCount = await db.collection('posts').where({ _openid: OPENID }).count();
    const publishedCount = await db.collection('posts').where({ _openid: OPENID, status: 'published' }).count();
    summary = { total: mineCount.total, published: publishedCount.total };
  }

  return {
    posts,
    hasMore: res.data.length > pageSize,
    summary
  };
};
