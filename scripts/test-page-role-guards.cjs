const assert = require('node:assert/strict');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const merchant = { role: 'merchant', verified: true, banned: false };

function applyData(target, patch) {
  Object.entries(patch).forEach(([key, value]) => {
    const parts = key.split('.');
    let cursor = target;
    for (let index = 0; index < parts.length - 1; index += 1) {
      cursor[parts[index]] = cursor[parts[index]] || {};
      cursor = cursor[parts[index]];
    }
    cursor[parts[parts.length - 1]] = value;
  });
}

function loadPage(relativePath, user, cloudHandler) {
  const calls = [];
  const toasts = [];
  const routes = [];
  const app = {
    globalData: { user },
    login: async () => user,
    ensureUser: async () => user
  };
  let definition;

  global.getApp = () => app;
  global.Page = (value) => { definition = value; };
  global.wx = {
    cloud: {
      callFunction: async ({ name, data }) => {
        calls.push({ name, data });
        return cloudHandler ? cloudHandler(name, data) : { result: {} };
      }
    },
    showToast: (options) => { toasts.push(options); },
    showActionSheet: (options) => { calls.push({ name: 'showActionSheet', data: options }); },
    navigateTo: (options) => { routes.push(options.url); },
    switchTab: (options) => { routes.push(options.url); }
  };

  const file = path.resolve(projectRoot, relativePath);
  delete require.cache[file];
  require(file);
  const page = { data: JSON.parse(JSON.stringify(definition.data || {})) };
  page.setData = (patch) => applyData(page.data, patch);
  Object.entries(definition).forEach(([key, value]) => {
    if (typeof value === 'function') page[key] = value.bind(page);
  });
  return { page, calls, toasts, routes };
}

async function testMerchantDetailGuards() {
  const state = loadPage('miniprogram/pages/detail/detail.js', merchant);
  state.page.data.id = 'post-1';

  await state.page.toggleLike();
  await state.page.toggleFavorite();
  await state.page.showContact();
  await state.page.report();

  assert.equal(state.calls.some((item) => item.name === 'toggleLikeFavorite'), false);
  assert.equal(state.calls.some((item) => item.name === 'getPostDetail'), false);
  assert.equal(state.calls.some((item) => item.name === 'showActionSheet'), false);
  assert.ok(state.toasts.some((item) => /商家账号/.test(item.title)));
}

async function testMerchantTopicGuard() {
  const state = loadPage('miniprogram/pages/topics/topics.js', merchant);
  await state.page.openComposer();
  assert.equal(state.page.data.composing, false);
  assert.ok(state.toasts.some((item) => /业主认证/.test(item.title)));
}

async function testAdminRedirect(relativePath) {
  const resident = { role: 'owner', verified: true, banned: false };
  const state = loadPage(relativePath, resident, async () => {
    throw new Error('需要管理员权限');
  });
  await state.page.load();
  assert.equal(state.page.data.accessDenied, true);
  assert.ok(state.routes.includes('/pages/profile/profile'));
  assert.ok(state.toasts.some((item) => /管理员权限/.test(item.title)));
}

(async () => {
  try {
    await testMerchantDetailGuards();
    await testMerchantTopicGuard();
    await testAdminRedirect('miniprogram/pages/admin/admin.js');
    await testAdminRedirect('miniprogram/pages/admin-m1/admin-m1.js');
    console.log('PAGE_ROLE_GUARD_TESTS_OK');
  } finally {
    delete global.getApp;
    delete global.Page;
    delete global.wx;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
