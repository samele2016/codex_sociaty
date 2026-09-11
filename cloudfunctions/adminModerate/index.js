const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const allCategories = ['idle', 'skill', 'partner', 'renovation', 'ad', 'groupbuy', 'chat', 'help'];
const merchantCategories = ['renovation', 'ad', 'groupbuy'];

async function assertAdmin(openid) {
  const res = await db.collection('users').where({ _openid: openid, banned: false }).limit(1).get();
  if (!res.data.length) {
    throw new Error('需要管理员权限');
  }
  const user = res.data[0];
  if (!['admin', 'system_admin', 'board_admin'].includes(user.role) && !(user.permissions || []).includes('owner_verification')) {
    throw new Error('需要管理员权限');
  }
  return user;
}

function isSystemAdmin(user) {
  return user.role === 'admin' || user.role === 'system_admin';
}

function canReviewOwners(user) {
  return isSystemAdmin(user) || (user.permissions || []).includes('owner_verification');
}

function normalizeCategories(value, allowed) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter((item) => allowed.includes(item)))];
}

function canManagePost(user, post) {
  return isSystemAdmin(user) || (user.role === 'board_admin' && (user.managedCategories || []).includes(post.category));
}

async function getReportPost(report) {
  if (!report || report.targetType !== 'post' || !report.targetId) return null;
  try {
    const result = await db.collection('posts').doc(report.targetId).get();
    return result.data || null;
  } catch (error) {
    return null;
  }
}

async function canManageReport(user, report) {
  if (isSystemAdmin(user)) return true;
  const post = await getReportPost(report);
  return Boolean(post && canManagePost(user, post));
}

async function log(action, targetType, targetId, openid, reason, after) {
  await db.collection('audit_logs').add({
    data: {
      action,
      targetType,
      targetId,
      operatorOpenid: openid,
      reason: reason || '',
      after: after || {},
      createdAt: db.serverDate()
    }
  });
}

async function notify(openid, type, title, content, route) {
  if (!openid) return;
  try {
    await db.collection('notifications').add({ data: {
      _openid: openid,
      type,
      title,
      content,
      route,
      read: false,
      createdAt: db.serverDate()
    } });
  } catch (error) { console.error('moderation notification failed', error); }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const operator = await assertAdmin(OPENID);
  const action = event.action || 'dashboard';

  if (action === 'dashboard') {
    const [pendingPostResult, reportResult, pendingUserResult] = await Promise.all([
      db.collection('posts').where({ status: 'pending' }).orderBy('createdAt', 'asc').limit(50).get(),
      db.collection('reports').where({ status: 'pending' }).orderBy('createdAt', 'asc').limit(50).get(),
      db.collection('users').where({ verificationStatus: 'pending' }).limit(50).get()
    ]);
    const pendingPosts = isSystemAdmin(operator)
      ? pendingPostResult.data
      : pendingPostResult.data.filter((post) => canManagePost(operator, post));
    const reports = isSystemAdmin(operator)
      ? reportResult.data
      : (await Promise.all(reportResult.data.map(async (report) => ((await canManageReport(operator, report)) ? report : null)))).filter(Boolean);
    const pendingUsers = canReviewOwners(operator) ? pendingUserResult.data : [];
    const users = isSystemAdmin(operator) ? await db.collection('users').count() : { total: 0 };
    const [verifiedUsers, merchantUsers] = isSystemAdmin(operator)
      ? await Promise.all([
        db.collection('users').where({ verified: true }).limit(100).get(),
        db.collection('users').where({ role: 'merchant', verified: true, banned: false }).limit(100).get()
      ])
      : [{ data: [] }, { data: [] }];
    const merchants = merchantUsers.data;
    const reviewers = verifiedUsers.data.filter((user) => ['owner', 'member', 'board_admin'].includes(user.role));
    return {
      pendingPosts,
      reports,
      pendingUsers,
      merchants,
      reviewers,
      canReviewOwners: canReviewOwners(operator),
      stats: {
        pending: pendingPosts.length,
        reports: reports.length,
        users: users.total
      }
    };
  }

  const postActions = {
    approvePost: { status: 'published', auditStatus: 'passed', auditReason: '' },
    removePost: { status: 'removed', auditStatus: 'removed' },
    featurePost: { featured: true },
    pinPost: { pinned: true }
  };

  if (postActions[action]) {
    const post = await db.collection('posts').doc(event.targetId).get();
    if (!canManagePost(operator, post.data)) throw new Error('无权管理该板块');
    if (action === 'featurePost' && !isSystemAdmin(operator)) throw new Error('仅系统管理员可设置精华内容');
    await db.collection('posts').doc(event.targetId).update({
      data: Object.assign({}, postActions[action], { updatedAt: db.serverDate() })
    });
    await log(action, 'post', event.targetId, OPENID, event.reason, postActions[action]);
    if (['approvePost', 'removePost'].includes(action) && post.data._openid !== OPENID) {
      const approved = action === 'approvePost';
      await notify(post.data._openid, 'post_moderation', approved ? '帖子审核已通过' : '帖子已下架', approved ? `“${String(post.data.title || '').slice(0, 24)}”已在社区展示。` : `“${String(post.data.title || '').slice(0, 24)}”已被管理员下架。`, approved ? `/pages/detail/detail?id=${event.targetId}` : '/pages/profile/profile');
    }
    return { ok: true };
  }

  if (action === 'resolveReport') {
    const report = await db.collection('reports').doc(event.targetId).get();
    if (!await canManageReport(operator, report.data)) throw new Error('无权处理该举报');
    await db.collection('reports').doc(event.targetId).update({
      data: {
        status: 'resolved',
        handledAt: db.serverDate(),
        handlerOpenid: OPENID
      }
    });
    await log(action, 'report', event.targetId, OPENID, event.reason, { linkedTargetId: event.linkedTargetId });
    return { ok: true };
  }

  if (action === 'approveUser' || action === 'rejectUser') {
    if (!canReviewOwners(operator)) throw new Error('当前账号没有业主认证审核权限');
    const userRes = await db.collection('users').doc(event.targetId).get();
    const update = action === 'approveUser'
      ? { verified: true, verificationStatus: 'approved', verifiedAt: db.serverDate() }
      : { verified: false, verificationStatus: 'rejected', verifiedAt: db.serverDate() };
    await db.collection('users').doc(event.targetId).update({ data: Object.assign({}, update, { updatedAt: db.serverDate() }) });
    await log(action, 'user', event.targetId, OPENID, event.reason, update);
    if (userRes.data && userRes.data._openid) {
      const approved = action === 'approveUser';
      await notify(userRes.data._openid, 'verification', approved ? '社区认证已通过' : '社区认证未通过', approved ? '你现在可以发布、评论并查看已授权的联系方式。' : '请检查房号和邀请码后重新提交认证申请。', '/pages/profile/profile');
    }
    return { ok: true, user: userRes.data };
  }

  if (action === 'assignMerchantCategories') {
    if (!isSystemAdmin(operator)) throw new Error('仅系统管理员可管理商家板块');
    const categories = normalizeCategories(event.categories, merchantCategories);
    if (!categories.length) throw new Error('请至少保留一个商家可发布板块');
    const targetResult = await db.collection('users').doc(event.targetId).get();
    const target = targetResult.data;
    if (!target || target.role !== 'merchant' || target.banned) throw new Error('只能配置已审核且未封禁的商家');
    await db.collection('users').doc(event.targetId).update({ data: {
      merchantCategories: categories,
      updatedAt: db.serverDate()
    } });
    await log(action, 'user', event.targetId, OPENID, event.reason, { merchantCategories: categories });
    return { ok: true };
  }

  if (action === 'setBoardAdmin') {
    if (!isSystemAdmin(operator)) throw new Error('仅系统管理员可指派板块管理员');
    const categories = normalizeCategories(event.categories, allCategories);
    const targetResult = await db.collection('users').doc(event.targetId).get();
    const target = targetResult.data;
    if (!target || target.banned || !target.verified || !['owner', 'member', 'board_admin'].includes(target.role)) {
      throw new Error('只能指派已认证且未封禁的业主为板块管理员');
    }
    await db.collection('users').doc(event.targetId).update({ data: {
      role: categories.length ? 'board_admin' : 'owner',
      managedCategories: categories,
      updatedAt: db.serverDate()
    } });
    await log(action, 'user', event.targetId, OPENID, event.reason, { role: categories.length ? 'board_admin' : 'owner', managedCategories: categories });
    return { ok: true };
  }

  if (action === 'setOwnerReviewer') {
    if (!isSystemAdmin(operator)) throw new Error('仅系统管理员可委派认证审核权限');
    const targetResult = await db.collection('users').doc(event.targetId).get();
    const target = targetResult.data;
    if (!target || target.banned || !target.verified || !['owner', 'member', 'board_admin'].includes(target.role)) {
      throw new Error('只能向已认证且未封禁的业主委派认证审核权限');
    }
    const permissions = new Set(target.permissions || []);
    if (event.enabled) permissions.add('owner_verification');
    else permissions.delete('owner_verification');
    const values = [...permissions];
    await db.collection('users').doc(event.targetId).update({ data: { permissions: values, updatedAt: db.serverDate() } });
    await log(action, 'user', event.targetId, OPENID, event.reason, { permissions: values });
    return { ok: true };
  }

  if (action === 'banUser') {
    if (!isSystemAdmin(operator)) throw new Error('仅系统管理员可封禁用户');
    if (event.targetId === operator._id) throw new Error('不能封禁当前管理员');
    await db.collection('users').doc(event.targetId).update({ data: { banned: true, updatedAt: db.serverDate() } });
    await log(action, 'user', event.targetId, OPENID, event.reason, { banned: true });
    return { ok: true };
  }

  throw new Error('未知管理操作');
};
