const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const serviceCategories = ['design', 'construction', 'material', 'furniture', 'cleaning'];
const allowedPostCategories = ['renovation', 'ad', 'groupbuy'];

async function userOf(openid) {
  const result = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return result.data[0] || null;
}

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

function isSystemAdmin(user) {
  return user && !user.banned && ['admin', 'system_admin'].includes(user.role);
}

function uniqueAllowed(values, allowed) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => clean(item, 40)).filter((item) => allowed.includes(item)))];
}

async function addAudit(data) {
  await db.collection('audit_logs').add({ data: Object.assign({ createdAt: db.serverDate() }, data) });
}

async function notify(openid, title, content) {
  if (!openid) return;
  try {
    await db.collection('notifications').add({ data: {
      _openid: openid,
      type: 'merchant_application',
      title,
      content,
      route: '/pages/profile/profile',
      read: false,
      createdAt: db.serverDate()
    } });
  } catch (error) { console.error('merchant notification failed', error); }
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
    throw new Error('\u516c\u5f00\u8d44\u6599\u672a\u901a\u8fc7\u5185\u5bb9\u5b89\u5168\u68c0\u6d4b');
  }
}

async function checkCaseImages(fileIds) {
  for (const fileId of fileIds) {
    try {
      const file = await cloud.downloadFile({ fileID: fileId });
      await cloud.openapi.security.imgSecCheck({
        media: { contentType: 'image/jpeg', value: file.fileContent }
      });
    } catch (error) {
      throw new Error('案例图片未通过安全检测，请更换后重试');
    }
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const user = await userOf(OPENID);
  if (!user || user.banned) throw new Error('\u8d26\u53f7\u6682\u4e0d\u53ef\u7528');
  const action = event.action || 'mine';

  if (action === 'submit') {
    if (user.role === 'merchant') throw new Error('该账号已经是入驻商家');
    const businessName = clean(event.businessName, 100);
    const description = clean(event.description, 1200);
    const serviceScope = clean(event.serviceScope, 200);
    const priceNotes = clean(event.priceNotes, 600);
    const contact = clean(event.contact, 100);
    const categories = uniqueAllowed(event.categories, serviceCategories);
    if (!businessName || !description || !serviceScope || !priceNotes || !contact || !categories.length) {
      throw new Error('\u8bf7\u5b8c\u6574\u586b\u5199\u5546\u5bb6\u540d\u79f0\u3001\u670d\u52a1\u7c7b\u522b\u3001\u4ecb\u7ecd\u3001\u670d\u52a1\u8303\u56f4\u3001\u62a5\u4ef7\u8bf4\u660e\u548c\u8054\u7cfb\u65b9\u5f0f');
    }
    if (/1[3-9]\d{9}|\b\d{17}[\dXx]\b/.test(`${description}\n${serviceScope}\n${priceNotes}`)) {
      throw new Error('\u516c\u5f00\u4ecb\u7ecd\u4e2d\u8bf7\u52ff\u586b\u5199\u624b\u673a\u53f7\u6216\u8eab\u4efd\u8bc1\u53f7\uff1b\u8054\u7cfb\u65b9\u5f0f\u4ec5\u7528\u4e8e\u540e\u53f0\u5ba1\u6838');
    }
    await checkText(OPENID, `${businessName}\n${description}\n${serviceScope}\n${priceNotes}`);
    const caseImages = Array.isArray(event.caseImages) ? event.caseImages.filter((item) => typeof item === 'string' && item.startsWith('cloud://')).slice(0, 6) : [];
    if ((Array.isArray(event.caseImages) ? event.caseImages.length : 0) !== caseImages.length) throw new Error('案例图片格式或数量无效');
    await checkCaseImages(caseImages);
    const existing = await db.collection('merchant_applications').where({ _openid: OPENID, status: 'pending' }).limit(1).get();
    if (existing.data.length) throw new Error('\u5df2\u6709\u4e00\u6761\u5f85\u5ba1\u6838\u7533\u8bf7');

    const result = await db.collection('merchant_applications').add({ data: {
      _openid: OPENID,
      applicantId: user._id,
      applicantType: user.verified ? 'verified_owner' : 'external_merchant',
      businessName,
      description,
      serviceScope,
      priceNotes,
      contact,
      categories,
      qualificationFiles: Array.isArray(event.qualificationFiles) ? event.qualificationFiles.slice(0, 6) : [],
      caseImages,
      status: 'pending',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    } });
    await addAudit({ action: 'submitMerchantApplication', targetType: 'merchant_application', targetId: result._id, operatorOpenid: OPENID, after: { categories, caseCount: Array.isArray(event.caseImages) ? event.caseImages.length : 0 } });
    return { ok: true, id: result._id };
  }

  if (action === 'mine') {
    const result = await db.collection('merchant_applications').where({ _openid: OPENID }).orderBy('createdAt', 'desc').limit(10).get();
    return { applications: result.data };
  }

  if (!isSystemAdmin(user)) throw new Error('\u9700\u8981\u7cfb\u7edf\u7ba1\u7406\u5458\u6743\u9650');
  if (action === 'dashboard') {
    const [applications, merchants] = await Promise.all([
      db.collection('merchant_applications').where({ status: 'pending' }).orderBy('createdAt', 'asc').limit(50).get(),
      db.collection('users').where({ role: 'merchant', verified: true, banned: false }).limit(50).get()
    ]);
    return {
      applications: applications.data,
      merchants: merchants.data.map((item) => ({
        _id: item._id,
        nickName: item.nickName || '\u672a\u547d\u540d\u5546\u5bb6',
        businessName: item.merchantBusinessName || item.nickName || '\u672a\u547d\u540d\u5546\u5bb6',
        merchantCategories: item.merchantCategories || []
      }))
    };
  }

  if (action === 'review') {
    const id = clean(event.id, 80);
    const status = clean(event.status, 30);
    if (!id || !['approved', 'rejected'].includes(status)) throw new Error('\u65e0\u6548\u5ba1\u6838\u64cd\u4f5c');
    const applicationResult = await db.collection('merchant_applications').doc(id).get();
    const application = applicationResult.data;
    if (!application || application.status !== 'pending') throw new Error('\u7533\u8bf7\u4e0d\u5b58\u5728\u6216\u5df2\u5904\u7406');

    const reviewNote = clean(event.note, 300);
    const update = { status, reviewedBy: OPENID, reviewedAt: db.serverDate(), updatedAt: db.serverDate(), reviewNote };
    if (status === 'approved') {
      const postCategories = uniqueAllowed(event.postCategories, allowedPostCategories);
      if (!postCategories.length) throw new Error('\u8bf7\u81f3\u5c11\u6307\u5b9a\u4e00\u4e2a\u5546\u5bb6\u53ef\u53d1\u5e03\u7684\u677f\u5757');
      update.postCategories = postCategories;
      await db.collection('users').doc(application.applicantId).update({ data: {
        role: 'merchant',
        verified: true,
        verificationStatus: 'approved',
        merchantCategories: postCategories,
        merchantApplicationStatus: 'approved',
        merchantBusinessName: application.businessName,
        merchantServiceCategories: application.categories || [],
        updatedAt: db.serverDate()
      } });
    } else {
      await db.collection('users').doc(application.applicantId).update({ data: {
        merchantApplicationStatus: 'rejected',
        updatedAt: db.serverDate()
      } });
    }
    await db.collection('merchant_applications').doc(id).update({ data: update });
    await addAudit({
      action: status === 'approved' ? 'approveMerchantApplication' : 'rejectMerchantApplication',
      targetType: 'merchant_application',
      targetId: id,
      operatorOpenid: OPENID,
      after: { status, postCategories: update.postCategories || [] }
    });
    await notify(application._openid, status === 'approved' ? '商家入驻申请已通过' : '商家入驻申请未通过', status === 'approved' ? '已为你配置可发布板块，商家帖子仍需管理员审核。' : '请在个人中心查看并根据审核意见重新准备申请资料。');
    return { ok: true };
  }

  throw new Error('\u672a\u77e5\u64cd\u4f5c');
};
