const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const originalLoad = Module._load;
const fakeCloud = {
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  database() {
    return { command: {} };
  }
};

Module._load = function load(request, parent, isMain) {
  if (request === 'wx-server-sdk') return fakeCloud;
  return originalLoad.call(this, request, parent, isMain);
};

function loadFunction(name) {
  const file = path.resolve(__dirname, '..', 'cloudfunctions', name, 'index.js');
  delete require.cache[file];
  return require(file)._test;
}

try {
  const contact = loadFunction('getPostDetail');
  const toggle = loadFunction('toggleLikeFavorite');
  const report = loadFunction('reportContent');
  const owner = { role: 'owner', verified: true, banned: false };
  const merchant = { role: 'merchant', verified: true, banned: false };

  assert.equal(contact.canViewPostContact(owner, false, true), true);
  assert.equal(contact.canViewPostContact(merchant, false, true), false);
  assert.equal(contact.canViewPostContact(merchant, true, true), true);
  assert.equal(contact.canViewPostContact({ ...owner, verified: false }, false, true), false);
  assert.equal(contact.canViewPostContact({ ...owner, banned: true }, false, true), false);
  assert.equal(contact.canViewPostContact(owner, false, false), false);

  assert.equal(toggle.assertEligibleUser(owner), owner);
  assert.throws(() => toggle.assertEligibleUser(merchant), /商家账号不能参与邻里互动/);
  assert.equal(report.assertEligibleUser(owner), owner);
  assert.throws(() => report.assertEligibleUser(merchant), /商家账号不能参与邻里互动/);

  console.log('ROLE_PERMISSION_TESTS_OK');
} finally {
  Module._load = originalLoad;
}
