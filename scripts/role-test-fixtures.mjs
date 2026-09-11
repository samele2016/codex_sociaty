import { spawnSync } from 'node:child_process';

const environmentId = process.env.CLOUDBASE_ENV_ID || 'cloud1-d2g3tkgc73fb08aa8';
const nodeBin = process.env.CLOUDBASE_NODE || 'D:\\Program Files\\nodejs\\node.exe';
const cli = process.env.CLOUDBASE_CLI || 'D:\\WeChatProjects\\YueShiFu_MiniSociety\\node_modules\\@cloudbase\\cli\\bin\\tcb';
const now = new Date().toISOString();

const ids = {
  resident: { openid: 'TEST_RESIDENT_20260812_OPENID', user: 'TEST_USER_RESIDENT_20260812' },
  admin: { openid: 'TEST_ADMIN_20260812_OPENID', user: 'TEST_USER_ADMIN_20260812' },
  merchant: { openid: 'TEST_MERCHANT_20260812_OPENID', user: 'TEST_USER_MERCHANT_20260812' },
  invite: 'TEST_INVITE_20260812',
  residentPost: 'TEST_POST_RESIDENT_20260812',
  merchantPost: 'TEST_POST_MERCHANT_20260812',
  merchantApplication: 'TEST_MERCHANT_APPLICATION_20260812',
  renovationRequest: 'TEST_RENOVATION_REQUEST_20260812',
  assignment: 'TEST_LEAD_ASSIGNMENT_20260812'
};

function run(command, tableName) {
  const payload = JSON.stringify([{
    TableName: tableName,
    CommandType: 'COMMAND',
    Command: JSON.stringify(command)
  }]);
  const result = spawnSync(nodeBin, [cli, '-e', environmentId, 'db', 'nosql', 'execute', '--command', payload, '--json'], {
    encoding: 'utf8',
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${tableName} command failed:\n${result.stdout}\n${result.stderr}`);
  }
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function upsert(collection, document) {
  run({
    update: collection,
    updates: [{
      q: { _id: document._id },
      u: { $set: document },
      upsert: true,
      multi: false
    }]
  }, collection);
}

function removeTestData() {
  const collections = {
    users: { _openid: { $regex: '^TEST_' } },
    invites: { code: { $regex: '^TEST_' } },
    posts: { _id: { $regex: '^TEST_' } },
    merchant_applications: { _id: { $regex: '^TEST_' } },
    renovation_requests: { _id: { $regex: '^TEST_' } },
    lead_assignments: { _id: { $regex: '^TEST_' } },
    audit_logs: { operatorOpenid: { $regex: '^TEST_' } },
    notifications: { _openid: { $regex: '^TEST_' } }
  };
  for (const [collection, q] of Object.entries(collections)) {
    run({ delete: collection, deletes: [{ q, limit: 0 }] }, collection);
  }
}

function seed() {
  const resident = {
    _id: ids.resident.user,
    _openid: ids.resident.openid,
    nickName: 'TEST_住户_20260812',
    role: 'owner',
    verified: true,
    verificationStatus: 'approved',
    houseNumber: '10-1902',
    building: '10',
    unit: '1902',
    privacyAccepted: true,
    banned: false,
    createdAt: now,
    updatedAt: now
  };
  const admin = {
    _id: ids.admin.user,
    _openid: ids.admin.openid,
    nickName: 'TEST_管理员_20260812',
    role: 'system_admin',
    verified: true,
    verificationStatus: 'approved',
    privacyAccepted: true,
    banned: false,
    createdAt: now,
    updatedAt: now
  };
  const merchant = {
    _id: ids.merchant.user,
    _openid: ids.merchant.openid,
    nickName: 'TEST_商家_20260812',
    role: 'merchant',
    verified: true,
    verificationStatus: 'approved',
    merchantBusinessName: 'TEST_装修服务商_20260812',
    merchantCategories: ['renovation', 'ad', 'groupbuy'],
    merchantServiceCategories: ['design', 'construction'],
    privacyAccepted: true,
    banned: false,
    createdAt: now,
    updatedAt: now
  };
  [resident, admin, merchant].forEach((item) => upsert('users', item));

  upsert('invites', {
    _id: ids.invite,
    code: 'TEST-20260812',
    building: '10',
    unit: '1902',
    usedCount: 0,
    maxUses: 1,
    disabled: false,
    expiresAt: '2027-08-12T23:59:59.000Z',
    createdAt: now,
    updatedAt: now
  });

  upsert('posts', {
    _id: ids.residentPost,
    _openid: ids.resident.openid,
    authorId: ids.resident.user,
    authorName: resident.nickName,
    category: 'renovation',
    categoryLabel: '装修心得',
    title: 'TEST_住户帖子_装修避坑记录',
    content: 'TEST_分享施工验收清单，欢迎邻居交流。',
    status: 'published',
    auditStatus: 'approved',
    pinned: false,
    featured: false,
    likeCount: 0,
    favoriteCount: 0,
    commentCount: 0,
    createdAt: now,
    updatedAt: now
  });

  upsert('posts', {
    _id: ids.merchantPost,
    _openid: ids.merchant.openid,
    authorId: ids.merchant.user,
    authorName: merchant.nickName,
    category: 'renovation',
    categoryLabel: '装修心得',
    title: 'TEST_商家帖子_服务说明',
    content: 'TEST_提供设计与施工服务，详情请通过平台咨询。',
    status: 'pending',
    auditStatus: 'pending',
    pinned: false,
    featured: false,
    likeCount: 0,
    favoriteCount: 0,
    commentCount: 0,
    createdAt: now,
    updatedAt: now
  });

  upsert('merchant_applications', {
    _id: ids.merchantApplication,
    _openid: ids.merchant.openid,
    userId: ids.merchant.user,
    businessName: merchant.merchantBusinessName,
    description: 'TEST_提供社区装修设计与施工服务。',
    serviceScope: 'TEST_设计、施工、预算咨询',
    priceNotes: 'TEST_按平台规则沟通报价',
    contact: 'TEST_CONTACT_DO_NOT_USE',
    categories: ['design', 'construction'],
    postCategories: ['renovation', 'ad', 'groupbuy'],
    caseImages: [],
    status: 'approved',
    reviewedBy: ids.admin.openid,
    reviewedAt: now,
    createdAt: now,
    updatedAt: now
  });

  upsert('renovation_requests', {
    _id: ids.renovationRequest,
    _openid: ids.resident.openid,
    userId: ids.resident.user,
    houseType: '三室两厅',
    budget: '20-30万',
    startDate: '2026-09',
    demand: 'TEST_需要设计与施工方案，不公开个人联系方式。',
    contactAuthorized: true,
    contact: 'TEST_CONTACT_DO_NOT_USE',
    status: 'assigned',
    source: 'renovation_service',
    assignedMerchantId: ids.merchant.user,
    createdAt: now,
    updatedAt: now
  });

  upsert('lead_assignments', {
    _id: ids.assignment,
    requestId: ids.renovationRequest,
    merchantId: ids.merchant.user,
    assignedBy: ids.admin.openid,
    status: 'assigned',
    createdAt: now,
    updatedAt: now
  });

  console.log(JSON.stringify({ ok: true, environmentId, ids }, null, 2));
}

const action = process.argv[2] || 'seed';
if (action === 'cleanup') {
  removeTestData();
  console.log(JSON.stringify({ ok: true, action, environmentId }, null, 2));
} else if (action === 'seed') {
  seed();
} else {
  throw new Error('Usage: node scripts/role-test-fixtures.mjs [seed|cleanup]');
}
